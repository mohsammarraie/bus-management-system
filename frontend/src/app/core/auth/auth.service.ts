import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  EMPTY,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  timeout,
} from 'rxjs';

export type ApplicationRole = 'ADMIN' | 'DRIVER' | 'PASSENGER';
export interface Account {
  id: string;
  username: string;
  roles: ApplicationRole[];
}
export type AuthNotice =
  | 'expired'
  | 'unavailable'
  | 'loginRequired'
  | 'forbidden'
  | 'loginFailed'
  | 'logoutFailed'
  | 'denied';
interface SessionState {
  status: 'loading' | 'authenticated' | 'anonymous' | 'unavailable';
  account: Account | null;
}
interface CsrfResponse {
  headerName: string;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = signal<SessionState>({ status: 'loading', account: null });
  private readonly message = signal<AuthNotice | null>(null);
  private readonly leaving = signal(false);
  private inFlight?: Observable<Account | null>;
  private revision = 0;

  readonly state = this.session.asReadonly();
  readonly account = computed(() => this.session().account);
  readonly notice = this.message.asReadonly();
  readonly busy = computed(() => this.session().status === 'loading' || this.leaving());

  hasAnyRole(...roles: ApplicationRole[]): boolean {
    return this.account()?.roles.some((role) => roles.includes(role)) ?? false;
  }

  showNotice(notice: AuthNotice | null): void {
    this.message.set(notice);
  }

  refresh(): Observable<Account | null> {
    if (this.leaving()) return of(null);
    if (this.inFlight) return this.inFlight;
    const revision = this.revision;
    this.session.update((state) => ({ ...state, status: 'loading' }));
    this.inFlight = this.http.get<Account>('/api/auth/me').pipe(
      // Authentication rotates CSRF state. Fetch a fresh cookie before enabling account actions.
      switchMap((account) =>
        this.http.get<CsrfResponse>('/api/auth/csrf').pipe(map(() => account)),
      ),
      timeout(8000),
      map((account) => {
        // An unrelated API 401 must win over an older, still-pending account response.
        if (revision !== this.revision) return null;
        this.session.set({ status: 'authenticated', account });
        if (this.notice() === 'unavailable') this.showNotice(null);
        return account;
      }),
      catchError((error: unknown) => {
        if (revision !== this.revision) return of(null);
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.expireSession();
        } else {
          this.session.set({ status: 'unavailable', account: null });
          this.showNotice('unavailable');
        }
        return of(null);
      }),
      finalize(() => {
        this.inFlight = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.inFlight;
  }

  resume(): Observable<Account | null> {
    // A cached document may return after logout navigation with its old busy flag.
    this.leaving.set(false);
    return this.refresh();
  }

  expireSession(): void {
    const wasSignedIn = this.account() !== null;
    this.revision++;
    this.session.set({ status: 'anonymous', account: null });
    if (wasSignedIn) {
      this.showNotice('expired');
      void this.router.navigateByUrl('/overview');
    } else if (this.notice() === 'unavailable') {
      this.showNotice(null);
    }
  }

  prepareLogout(): Observable<string> {
    if (this.busy() || !this.account()) return EMPTY;
    this.leaving.set(true);
    return this.http.get<CsrfResponse>('/api/auth/csrf').pipe(
      timeout(8000),
      map((csrf) => csrf.token),
      catchError(() => {
        this.logoutFailed();
        return EMPTY;
      }),
    );
  }

  logoutFailed(): void {
    this.leaving.set(false);
    this.showNotice('logoutFailed');
  }
}
