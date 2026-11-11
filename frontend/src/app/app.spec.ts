import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './app';
import { LAYOUT_QUERIES } from './core/layout/layout-queries';
import { LANGUAGE_STORAGE } from './core/i18n/language.service';
import { provideAppTranslations } from './core/i18n/translations';

@Component({ template: '<h1 id="page-title" tabindex="-1">Test page</h1>' })
class TestPage {}

function gate() {
  let resolve!: (allowed: boolean) => void;
  let reject!: (reason: Error) => void;
  let enter!: () => void;
  const entered = new Promise<void>((ready) => (enter = ready));
  const pending = new Promise<boolean>((allow, fail) => {
    resolve = allow;
    reject = fail;
  });
  return {
    entered,
    resolve,
    reject,
    guard: () => {
      enter();
      return pending;
    },
  };
}

async function setup() {
  const first = gate();
  const second = gate();
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      provideRouter([
        { path: 'overview', component: TestPage },
        { path: 'first', component: TestPage, canActivate: [first.guard] },
        { path: 'second', component: TestPage, canActivate: [second.guard] },
      ]),
      {
        provide: LAYOUT_QUERIES,
        useValue: { compact: '(max-width: 699px)', navigation: '(max-width: 959px)' },
      },
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAppTranslations(),
      { provide: LANGUAGE_STORAGE, useValue: null },
    ],
  });
  const fixture = TestBed.createComponent(App);
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
  const router = TestBed.inject(Router);
  fixture.detectChanges();
  await router.navigateByUrl('/overview');
  fixture.detectChanges();
  const overlay = () => {
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('main > app-loading-overlay') as HTMLElement;
  };
  return { fixture, router, first, second, overlay };
}

afterEach(() => TestBed.inject(HttpTestingController).verify());

describe('page navigation loading', () => {
  for (const allowed of [true, false]) {
    it(`clears the overlay when a pending guard ${allowed ? 'allows' : 'cancels'} navigation`, async () => {
      const { fixture, router, first, overlay } = await setup();
      expect(overlay().classList.contains('active')).toBe(false);
      const navigation = router.navigateByUrl('/first');
      await first.entered;
      expect(overlay().classList.contains('active')).toBe(true);
      expect(overlay().getAttribute('aria-live')).toBe('polite');
      expect(overlay().textContent).toContain('Loading page');
      expect(fixture.nativeElement.querySelector('main > div').getAttribute('aria-busy')).toBe(
        'true',
      );
      first.resolve(allowed);
      expect(await navigation).toBe(allowed);
      expect(overlay().classList.contains('active')).toBe(false);
      expect(fixture.nativeElement.querySelector('main > div').getAttribute('aria-busy')).toBe(
        'false',
      );
      expect(fixture.nativeElement.querySelector('h1')).not.toBeNull();
    });
  }

  it('clears the overlay when navigation fails', async () => {
    const { router, first, overlay } = await setup();
    const navigation = router.navigateByUrl('/first');
    const rejected = expect(navigation).rejects.toThrow('Synthetic guard failure');
    await first.entered;
    expect(overlay().classList.contains('active')).toBe(true);
    first.reject(new Error('Synthetic guard failure'));
    await rejected;
    expect(overlay().classList.contains('active')).toBe(false);
  });

  it('keeps the overlay active when a newer pending navigation supersedes an older one', async () => {
    const { router, first, second, overlay } = await setup();
    const older = router.navigateByUrl('/first');
    await first.entered;
    const newer = router.navigateByUrl('/second');
    await second.entered;
    expect(await older).toBe(false);
    first.resolve(true);
    expect(overlay().classList.contains('active')).toBe(true);
    second.resolve(true);
    expect(await newer).toBe(true);
    expect(overlay().classList.contains('active')).toBe(false);
  });
});
