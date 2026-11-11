import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore, Store } from '@ngrx/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BusesApi } from './buses.api';
import { BusesEffects } from './buses.effects';
import { Bus, BusPage, DEFAULT_BUS_QUERY } from './buses.models';
import { busesActions as actions, busesFeature as feature } from './buses.state';

const bus: Bus = { id: 7, registrationNumber: 'TEST-7', capacity: 40, active: true, version: 2 };
const result: BusPage = { content: [bus], page: 0, size: 20, totalElements: 1, totalPages: 1 };
let store: Store;
let http: HttpTestingController;
const list = () => http.expectOne((r) => r.url === '/api/v1/buses' && r.method === 'GET');
const rows = () => store.selectSignal(feature.selectRows)();

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideStore(),
      provideState(feature),
      provideEffects(BusesEffects),
      BusesApi,
    ],
  });
  store = TestBed.inject(Store);
  http = TestBed.inject(HttpTestingController);
});
afterEach(() => {
  http.verify();
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; Path=/';
});

describe('buses server state and effects', () => {
  it('cancels superseded searches and sends literal query values through HttpParams', () => {
    store.dispatch(actions.pageOpened());
    const old = list();
    store.dispatch(
      actions.queryChanged({ query: { ...DEFAULT_BUS_QUERY, q: '%_\\', active: 'false' } }),
    );
    expect(old.cancelled).toBe(true);
    const latest = list();
    expect(latest.request.params.get('q')).toBe('%_\\');
    expect(latest.request.params.get('active')).toBe('false');
    latest.flush(result);
    expect(rows()).toEqual([bus]);
  });
  it('retains rows while loading, clears them on failure and permits an explicit retry', () => {
    store.dispatch(actions.pageOpened());
    list().flush(result);
    store.dispatch(actions.refreshRequested());
    expect(rows()).toEqual([bus]);
    list().flush(
      { code: 'INTERNAL_ERROR', privateDetail: 'must-not-be-stored' },
      { status: 500, statusText: 'Error' },
    );
    expect(rows()).toEqual([]);
    expect(store.selectSignal(feature.selectError)()).toEqual({ code: 'UNAVAILABLE' });
    store.dispatch(actions.refreshRequested());
    list().flush(result);
    expect(rows()).toEqual([bus]);
  });
  it('returns to the last available page when its final row disappears', () => {
    store.dispatch(actions.queryChanged({ query: { ...DEFAULT_BUS_QUERY, page: 2 } }));
    list().flush({ ...result, content: [], page: 2, totalElements: 40, totalPages: 2 });
    const adjusted = list();
    expect(adjusted.request.params.get('page')).toBe('1');
    adjusted.flush({ ...result, page: 1 });
    expect(store.selectSignal(feature.selectQuery)().page).toBe(1);
  });
  it('allows only one in-flight mutation and never retries a duplicate registration', () => {
    const draft = { registrationNumber: 'TEST-7', capacity: 40, active: true };
    store.dispatch(actions.saveRequested({ command: { kind: 'create', draft } }));
    store.dispatch(actions.saveRequested({ command: { kind: 'create', draft } }));
    const request = http.expectOne('/api/v1/buses');
    expect(request.request.body).toEqual(draft);
    request.flush({ code: 'BUS_REGISTRATION_CONFLICT' }, { status: 409, statusText: 'Conflict' });
    http.expectNone('/api/v1/buses');
    expect(store.selectSignal(feature.selectMutationError)()?.code).toBe(
      'BUS_REGISTRATION_CONFLICT',
    );
  });
  it('requires an explicit latest-record reload after a version conflict', () => {
    store.dispatch(actions.dialogOpened({ bus }));
    const draft = { registrationNumber: bus.registrationNumber, capacity: 45, active: false };
    store.dispatch(actions.saveRequested({ command: { kind: 'update', bus, draft } }));
    const request = http.expectOne('/api/v1/buses/7');
    expect(request.request.body).toEqual({ ...draft, version: 2 });
    request.flush({ code: 'BUS_VERSION_CONFLICT' }, { status: 409, statusText: 'Conflict' });
    http.expectNone('/api/v1/buses/7');
    expect(store.selectSignal(feature.selectSelectedBus)()?.version).toBe(2);
    store.dispatch(actions.latestRequested({ id: 7 }));
    http.expectOne('/api/v1/buses/7').flush({ ...bus, version: 3, capacity: 50 });
    expect(store.selectSignal(feature.selectSelectedBus)()?.version).toBe(3);
    expect(store.selectSignal(feature.selectMutationError)()).toBeNull();
  });
  it('sends the expected version on delete and reloads the server query after success', () => {
    store.dispatch(actions.saveRequested({ command: { kind: 'delete', bus } }));
    const request = http.expectOne('/api/v1/buses/7?version=2');
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });
    list().flush({ ...result, content: [], totalElements: 0, totalPages: 0 });
    expect(rows()).toEqual([]);
    expect(store.selectSignal(feature.selectMutation)()).toBe('succeeded');
  });
  it('clears data and cancels pending work when leaving, then loads on re-entry', () => {
    store.dispatch(actions.pageOpened());
    list().flush(result);
    store.dispatch(actions.refreshRequested());
    const pending = list();
    store.dispatch(actions.pageLeft());
    expect(pending.cancelled).toBe(true);
    expect(rows()).toEqual([]);
    expect(store.selectSignal(feature.selectSelectedBus)()).toBeNull();
    store.dispatch(actions.pageOpened());
    list().flush(result);
    expect(rows()).toEqual([bus]);
  });
  it('uses Angular XSRF protection for writes with the raw cookie token', () => {
    document.cookie = 'XSRF-TOKEN=synthetic-raw-cookie; Path=/';
    TestBed.inject(HttpClient).post('/api/v1/buses', {}).subscribe();
    const request = http.expectOne('/api/v1/buses');
    expect(request.request.headers.get('X-XSRF-TOKEN')).toBe('synthetic-raw-cookie');
    request.flush(bus);
  });
  it('cancels a pending mutation on leaving without replaying it on re-entry', () => {
    store.dispatch(actions.dialogOpened({ bus }));
    store.dispatch(actions.saveRequested({ command: { kind: 'delete', bus } }));
    const pending = http.expectOne('/api/v1/buses/7?version=2');
    store.dispatch(actions.pageLeft());
    expect(pending.cancelled).toBe(true);
    expect(store.selectSignal(feature.selectSelectedBus)()).toBeNull();
    store.dispatch(actions.pageOpened());
    list().flush(result);
    http.expectNone((request) => request.method === 'DELETE');
  });
  it('cancels a latest-record reload when its dialog closes', () => {
    store.dispatch(actions.dialogOpened({ bus }));
    store.dispatch(actions.latestRequested({ id: bus.id }));
    const pending = http.expectOne('/api/v1/buses/7');
    store.dispatch(actions.dialogClosed());
    expect(pending.cancelled).toBe(true);
    expect(store.selectSignal(feature.selectSelectedBus)()).toBeNull();
    expect(store.selectSignal(feature.selectMutation)()).toBe('idle');
  });
});
