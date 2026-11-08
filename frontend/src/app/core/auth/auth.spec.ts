import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requireAccount } from './account.guard';
import { Account, AuthService } from './auth.service';
import { sessionInterceptor } from './session.interceptor';

const driver: Account = { id: 'driver-subject', username: 'demo-driver', roles: ['DRIVER'] };
const csrf = { headerName: 'X-XSRF-TOKEN', token: 'masked-form-token' };
let auth: AuthService;
let http: HttpTestingController;
let client: HttpClient;
let router: Router;

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([sessionInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  auth = TestBed.inject(AuthService);
  http = TestBed.inject(HttpTestingController);
  client = TestBed.inject(HttpClient);
  router = TestBed.inject(Router);
  vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
});
afterEach(() => http.verify());

function finishAccount(account = driver) {
  http.expectOne('/api/auth/me').flush(account);
  http.expectOne('/api/auth/csrf').flush(csrf);
}
function signedIn(account = driver) {
  auth.refresh().subscribe();
  finishAccount(account);
}

describe('server-managed account state', () => {
  it('shares startup/guard requests and enables account actions only after fresh CSRF', () => {
    auth.refresh().subscribe();
    auth.refresh().subscribe();
    http.expectOne('/api/auth/me').flush(driver);
    expect(auth.busy()).toBe(true);
    expect(auth.account()).toBeNull();
    http.expectOne('/api/auth/csrf').flush(csrf);
    expect(auth.account()).toEqual(driver);
    expect(auth.busy()).toBe(false);
    expect(auth.hasAnyRole('ADMIN', 'DRIVER')).toBe(true);
    expect(auth.hasAnyRole('ADMIN')).toBe(false);
  });
  it('treats initial 401 as an anonymous visitor without an expiry warning', () => {
    auth.refresh().subscribe();
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.state().status).toBe('anonymous');
    expect(auth.notice()).toBeNull();
  });
  it('distinguishes an unavailable backend from a signed-out visitor and supports retry', () => {
    auth.refresh().subscribe();
    http.expectOne('/api/auth/me').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(auth.state().status).toBe('unavailable');
    expect(auth.notice()).toBe('unavailable');
    auth.refresh().subscribe();
    finishAccount();
    expect(auth.notice()).toBeNull();
  });
  it('clears a connection warning when retry confirms an anonymous session', () => {
    auth.refresh().subscribe();
    http.expectOne('/api/auth/me').flush({}, { status: 503, statusText: 'Unavailable' });
    auth.refresh().subscribe();
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.state().status).toBe('anonymous');
    expect(auth.notice()).toBeNull();
  });
  it('clears expired identity and returns to a public page when a guarded refresh gets 401', () => {
    signedIn();
    auth.refresh().subscribe();
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.account()).toBeNull();
    expect(auth.notice()).toBe('expired');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/overview');
  });
  it('does not resurrect an account from a response that predates an API 401', () => {
    signedIn();
    auth.refresh().subscribe();
    const pending = http.expectOne('/api/auth/me');
    client.get('/api/test-session').subscribe({ error: () => undefined });
    http.expectOne('/api/test-session').flush({}, { status: 401, statusText: 'Unauthorized' });
    pending.flush(driver);
    http.expectOne('/api/auth/csrf').flush(csrf);
    expect(auth.account()).toBeNull();
    expect(auth.notice()).toBe('expired');
  });
  it('keeps an authenticated session on 403, shows a message and never retries a mutation', () => {
    signedIn();
    client.post('/api/test-mutation', {}).subscribe({ error: () => undefined });
    http.expectOne('/api/test-mutation').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(auth.account()).toEqual(driver);
    expect(auth.notice()).toBe('denied');
  });
  it('does not treat errors from another origin as application session expiry', () => {
    signedIn();
    client.get('https://example.test/api/data').subscribe({ error: () => undefined });
    http
      .expectOne('https://example.test/api/data')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.account()).toEqual(driver);
  });
  it('fetches a fresh form token for logout and blocks duplicate submission', () => {
    signedIn();
    const tokens: string[] = [];
    auth.prepareLogout().subscribe((token) => tokens.push(token));
    auth.prepareLogout().subscribe((token) => tokens.push(token));
    http.expectOne('/api/auth/csrf').flush(csrf);
    expect(tokens).toEqual([csrf.token]);
    http.expectNone('/api/auth/logout'); // Logout must be a browser navigation, not an HTTP fetch.
    expect(auth.busy()).toBe(true);
  });
  it('rechecks a restored document even if logout navigation left it busy', () => {
    signedIn();
    auth.prepareLogout().subscribe();
    http.expectOne('/api/auth/csrf').flush(csrf);
    auth.resume().subscribe();
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.account()).toBeNull();
    expect(auth.busy()).toBe(false);
  });
  it('keeps the account available for retry when logout preparation fails', () => {
    signedIn();
    auth.prepareLogout().subscribe();
    http.expectOne('/api/auth/csrf').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(auth.account()).toEqual(driver);
    expect(auth.busy()).toBe(false);
    expect(auth.notice()).toBe('logoutFailed');
  });
});

describe('route access', () => {
  function guard(...roles: ('ADMIN' | 'DRIVER' | 'PASSENGER')[]) {
    const fn = requireAccount(...roles);
    return TestBed.runInInjectionContext(() => fn({} as never, {} as never)) as Observable<
      boolean | UrlTree
    >;
  }
  it('waits for the account before allowing a direct driver URL', async () => {
    const result = firstValueFrom(guard('ADMIN', 'DRIVER'));
    finishAccount();
    expect(await result).toBe(true);
  });
  it('rejects a passenger opening a privileged URL directly', async () => {
    const result = firstValueFrom(guard('ADMIN', 'DRIVER'));
    finishAccount({ id: 'passenger', username: 'passenger', roles: ['PASSENGER'] });
    expect(router.serializeUrl((await result) as UrlTree)).toBe('/overview');
    expect(auth.notice()).toBe('forbidden');
  });
  it('sends an anonymous protected-route visitor to the overview with a login message', async () => {
    const result = firstValueFrom(guard());
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(router.serializeUrl((await result) as UrlTree)).toBe('/overview');
    expect(auth.notice()).toBe('loginRequired');
  });
});
