import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../core/auth/auth.service';
import { LANGUAGE_STORAGE } from '../core/i18n/language.service';
import { provideAppTranslations } from '../core/i18n/translations';
import { AccountControls } from './account-controls';

function setup() {
  TestBed.configureTestingModule({
    imports: [AccountControls],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAppTranslations(),
      { provide: LANGUAGE_STORAGE, useValue: null },
    ],
  });
  const fixture = TestBed.createComponent(AccountControls);
  const auth = TestBed.inject(AuthService);
  const http = TestBed.inject(HttpTestingController);
  auth.refresh().subscribe();
  http.expectOne('/api/auth/me').flush({ id: 'driver-id', username: 'driver', roles: ['DRIVER'] });
  http.expectOne('/api/auth/csrf').flush({ headerName: 'X-XSRF-TOKEN', token: 'initial-token' });
  fixture.detectChanges();
  const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
  return { fixture, auth, http, form };
}

afterEach(() => {
  TestBed.inject(HttpTestingController).verify();
  vi.restoreAllMocks();
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
});

describe('declarative logout form', () => {
  it('waits for a fresh token, then submits the existing template form exactly once', () => {
    const { form, http, auth } = setup();
    const submit = vi.spyOn(form, 'submit').mockImplementation(() => undefined);
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(submit).not.toHaveBeenCalled();
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    http
      .expectOne('/api/auth/csrf')
      .flush({ headerName: 'X-XSRF-TOKEN', token: 'fresh-masked-token' });
    expect(submit).toHaveBeenCalledOnce();
    expect(form.getAttribute('method')).toBe('post');
    expect(form.getAttribute('action')).toBe('/api/auth/logout');
    expect(new FormData(form).get('_csrf')).toBe('fresh-masked-token');
    expect(auth.busy()).toBe(true);
    http.expectNone('/api/auth/logout');
  });

  it('allows retry if native form submission throws', () => {
    const { form, http, auth, fixture } = setup();
    vi.spyOn(form, 'submit').mockImplementation(() => {
      throw new Error('Submission unavailable');
    });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    http
      .expectOne('/api/auth/csrf')
      .flush({ headerName: 'X-XSRF-TOKEN', token: 'fresh-masked-token' });
    fixture.detectChanges();
    expect(auth.busy()).toBe(false);
    expect(auth.notice()).toBe('logoutFailed');
    expect(form.querySelector<HTMLButtonElement>('button')?.disabled).toBe(false);
    expect(auth.account()?.username).toBe('driver');
  });
});
