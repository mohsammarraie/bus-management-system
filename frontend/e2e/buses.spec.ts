import AxeBuilder from '@axe-core/playwright';
import { expect, Page } from '@playwright/test';
import { test } from './fixtures';
import type { Bus } from '../src/app/features/buses/buses.models';
import en from '../src/app/core/i18n/messages/en.json';
import de from '../src/app/core/i18n/messages/de.json';
import ar from '../src/app/core/i18n/messages/ar.json';

const messages = { en, de, ar };

async function busesApi(page: Page, role: string | null = 'ADMIN') {
  const state = {
    rows: Array.from({ length: 30 }, (_, i): Bus => ({
      id: i + 1,
      registrationNumber: `DEMO-BUS-${String(i + 1).padStart(3, '0')}`,
      capacity: 20 + (i % 4) * 10,
      active: (i + 1) % 5 !== 0,
      version: 0,
    })),
    requests: [] as { method: string; url: URL; body: Record<string, unknown> | null }[],
    failure: null as { method: string; status: number; code: string } | null,
    dropWrite: false,
    pause: null as { method: string; until: Promise<void> } | null,
  };
  await page.route('**/api/auth/me', (route) =>
    role
      ? route.fulfill({ json: { id: 'synthetic-admin', username: 'demo-user', roles: [role] } })
      : route.fulfill({ status: 401, json: { code: 'AUTHENTICATION_REQUIRED' } }),
  );
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({
      headers: { 'set-cookie': 'XSRF-TOKEN=raw-buses-token; Path=/; SameSite=Lax' },
      json: { headerName: 'X-XSRF-TOKEN', token: 'masked-form-only' },
    }),
  );
  await page.route('**/api/v1/buses**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const body = request.postDataJSON() as Record<string, unknown> | null;
    state.requests.push({ method, url, body });
    if (state.pause?.method === method) await state.pause.until;
    if (method !== 'GET') {
      expect(request.headers()['x-xsrf-token']).toBe('raw-buses-token');
      if (state.dropWrite) {
        await route.abort('failed');
        return;
      }
    }
    if (state.failure?.method === method) {
      const failure = state.failure;
      state.failure = null;
      await route.fulfill({ status: failure.status, json: { code: failure.code } });
      return;
    }
    const id = Number(url.pathname.split('/')[4]);
    if (method === 'GET' && !id) {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const active = url.searchParams.get('active');
      const sort = url.searchParams.get('sort') as 'registrationNumber' | 'capacity' | 'active';
      const direction = url.searchParams.get('direction') === 'desc' ? -1 : 1;
      const rows = state.rows
        .filter(
          (row) =>
            row.registrationNumber.toLowerCase().includes(q) &&
            (!active || String(row.active) === active),
        )
        .sort((a, b) => {
          const left = a[sort];
          const right = b[sort];
          return (left < right ? -1 : left > right ? 1 : 0) * direction || a.id - b.id;
        });
      const pageIndex = Number(url.searchParams.get('page'));
      const size = Number(url.searchParams.get('size'));
      await route.fulfill({
        json: {
          content: rows.slice(pageIndex * size, (pageIndex + 1) * size),
          page: pageIndex,
          size,
          totalElements: rows.length,
          totalPages: Math.ceil(rows.length / size),
        },
      });
    } else if (method === 'GET') {
      await route.fulfill({ json: state.rows.find((row) => row.id === id) });
    } else if (method === 'POST') {
      if (state.rows.some((row) => row.registrationNumber === body?.['registrationNumber'])) {
        await route.fulfill({ status: 409, json: { code: 'BUS_REGISTRATION_CONFLICT' } });
        return;
      }
      const row = {
        id: Math.max(0, ...state.rows.map((b) => b.id)) + 1,
        ...body,
        version: 0,
      } as unknown as Bus;
      state.rows.push(row);
      await route.fulfill({ status: 201, json: row });
    } else if (method === 'PUT') {
      const row = state.rows.find((row) => row.id === id)!;
      if (row.version !== body?.['version']) {
        await route.fulfill({ status: 409, json: { code: 'BUS_VERSION_CONFLICT' } });
        return;
      }
      Object.assign(row, body, { version: row.version + 1 });
      await route.fulfill({ json: row });
    } else if (method === 'DELETE') {
      const row = state.rows.find((row) => row.id === id)!;
      expect(url.searchParams.get('version')).toBe(String(row.version));
      state.rows = state.rows.filter((row) => row.id !== id);
      await route.fulfill({ status: 204 });
    }
  });
  return state;
}

function busActionTrigger(page: Page, action: 'Edit' | 'Delete', registration: string) {
  return page.getByRole('button', {
    name: (page.viewportSize()!.width < 700 ? 'Actions for ' : action + ' ') + registration,
    exact: true,
  });
}

async function openBusAction(page: Page, action: 'Edit' | 'Delete', registration: string) {
  const trigger = busActionTrigger(page, action, registration);
  await trigger.click();
  if (page.viewportSize()!.width < 700) {
    await page.getByRole('menuitem', { name: action, exact: true }).click();
  }
  return trigger;
}

for (const role of [null, 'PASSENGER', 'DRIVER']) {
  test(`${role ?? 'anonymous'} cannot enter buses or request its API`, async ({ page }) => {
    const state = await busesApi(page, role);
    await page.goto('/buses');
    await expect(page).toHaveURL(/\/overview$/);
    expect(state.requests).toHaveLength(0);
    await expect(page.getByRole('link', { name: 'Buses', exact: true })).toHaveCount(0);
  });
}

test('server paging and sorting preserve state; search and filters require explicit submission', async ({
  page,
}) => {
  const state = await busesApi(page);
  await page.goto('/buses');
  await expect(page.locator('.bus-entry')).toHaveCount(20);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.locator('.bus-entry')).toHaveCount(10);
  await expect(page.locator('.bus-results')).toContainText('DEMO-BUS-021');
  await page
    .getByRole('columnheader', { name: 'Passenger capacity', exact: true })
    .getByRole('button')
    .click();
  await expect.poll(() => state.requests.at(-1)?.url.searchParams.get('sort')).toBe('capacity');
  await expect.poll(() => state.requests.at(-1)?.url.searchParams.get('page')).toBe('0');
  await page.clock.install();
  const beforeSearch = state.requests.length;
  await page.getByRole('searchbox', { name: 'Search registration' }).fill('DEMO-BUS-00');
  await page.clock.fastForward(1000);
  expect(state.requests).toHaveLength(beforeSearch);
  await page.getByRole('searchbox', { name: 'Search registration' }).press('Enter');
  await expect(page.locator('.bus-entry')).toHaveCount(9);
  await page.getByRole('combobox', { name: 'Status', exact: true }).click();
  const beforeFilter = state.requests.length;
  await page.getByRole('option', { name: 'Inactive', exact: true }).click();
  await page.clock.fastForward(1000);
  expect(state.requests).toHaveLength(beforeFilter);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.bus-entry')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Language', exact: true }).click();
  await page.getByRole('option', { name: 'Deutsch', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Kennzeichen suchen' })).toHaveValue(
    'DEMO-BUS-00',
  );
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toContainText(
    'Inaktiv',
  );
  await expect(page.locator('mat-paginator')).toContainText('1–1 von 1');
  await expect(page).toHaveTitle('Busse | Busverwaltung');
});

test('refresh repeats the applied query; Reset clears draft and applied filters with one request', async ({
  page,
}) => {
  const state = await busesApi(page);
  await page.goto('/buses');
  await expect(page.locator('.bus-entry')).toHaveCount(20);
  const search = page.getByRole('searchbox', { name: 'Search registration' });
  const status = page.getByRole('combobox', { name: 'Status', exact: true });
  await search.fill('DEMO-BUS-0');
  await status.click();
  await page.getByRole('option', { name: 'Active', exact: true }).click();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('mat-paginator')).toContainText('1–20 of 24');
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.locator('.bus-entry')).toHaveCount(4);
  await search.fill('draft-not-applied');
  await status.click();
  await page.getByRole('option', { name: 'Inactive', exact: true }).click();
  const refresh = page.getByRole('button', { name: 'Refresh list', exact: true });
  const beforeRefresh = state.requests.length;
  await refresh.click();
  await expect.poll(() => state.requests.length).toBe(beforeRefresh + 1);
  await expect(refresh).toBeEnabled();
  expect(state.requests.at(-1)?.url.searchParams.get('q')).toBe('DEMO-BUS-0');
  expect(state.requests.at(-1)?.url.searchParams.get('active')).toBe('true');
  expect(state.requests.at(-1)?.url.searchParams.get('page')).toBe('1');
  await expect(search).toHaveValue('draft-not-applied');
  await expect(status).toContainText('Inactive');
  const beforeReset = state.requests.length;
  const reset = page.getByRole('button', { name: 'Reset filters', exact: true });
  await reset.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.bus-entry')).toHaveCount(20);
  await expect(search).toHaveValue('');
  await expect(status).toContainText('All statuses');
  expect(state.requests).toHaveLength(beforeReset + 1);
  const params = state.requests.at(-1)!.url.searchParams;
  expect(params.get('q')).toBeNull();
  expect(params.get('active')).toBeNull();
  expect(params.get('page')).toBe('0');
  expect(params.get('size')).toBe('20');
  expect(params.get('sort')).toBe('registrationNumber');
  await expect(page.locator('mat-paginator')).toContainText('1–20 of 30');
});

test('create validates input, preserves duplicate errors, saves once, edits availability and deletes with confirmation', async ({
  page,
}) => {
  const state = await busesApi(page);
  await page.goto('/buses');
  const add = page.getByRole('button', { name: 'Add bus', exact: true });
  await add.click();
  let dialog = page.getByRole('dialog', { name: 'Add bus', exact: true });
  await dialog.getByRole('button', { name: 'Save bus', exact: true }).click();
  await expect(dialog).toContainText('This field is required.');
  expect(state.requests.filter((r) => r.method === 'POST')).toHaveLength(0);
  await dialog.getByRole('textbox', { name: 'Registration number' }).fill(' BAD ');
  await dialog.getByRole('spinbutton', { name: 'Passenger capacity' }).fill('1.5');
  await dialog.getByRole('button', { name: 'Save bus', exact: true }).click();
  await expect(dialog).toContainText('Remove surrounding spaces');
  await expect(dialog).toContainText('Enter a whole number.');
  await dialog.getByRole('textbox', { name: 'Registration number' }).fill('DEMO-BUS-001');
  await dialog.getByRole('spinbutton', { name: 'Passenger capacity' }).fill('42');
  await dialog.getByRole('button', { name: 'Save bus', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('already in use');
  await expect(page.locator('mat-snack-bar-container')).toHaveCount(0);
  await dialog.getByRole('textbox', { name: 'Registration number' }).fill('NEW-BUS');
  const readsBeforeSave = state.requests.filter((request) => request.method === 'GET').length;
  await dialog.getByRole('button', { name: 'Save bus', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(add).toBeFocused();
  await expect(page.locator('mat-snack-bar-container')).toHaveText('Bus created.');
  expect(state.requests.filter((request) => request.method === 'GET')).toHaveLength(
    readsBeforeSave + 1,
  );
  await page.getByRole('searchbox', { name: 'Search registration' }).fill('NEW-BUS');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.bus-entry')).toHaveCount(1);
  await openBusAction(page, 'Edit', 'NEW-BUS');
  dialog = page.getByRole('dialog', { name: 'Edit bus', exact: true });
  await dialog.getByRole('checkbox', { name: 'Active', exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Save bus', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.bus-results')).toContainText('Inactive');
  await expect(page.locator('mat-snack-bar-container')).toHaveText('Bus updated.');
  expect(state.requests.find((r) => r.method === 'PUT')?.body).toMatchObject({
    active: false,
    version: 0,
  });
  await openBusAction(page, 'Delete', 'NEW-BUS');
  dialog = page.getByRole('dialog', { name: 'Delete bus', exact: true });
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  expect(state.requests.filter((r) => r.method === 'DELETE')).toHaveLength(0);
  await openBusAction(page, 'Delete', 'NEW-BUS');
  await page.getByRole('button', { name: 'Delete permanently', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('No buses match your search or filters.')).toBeVisible();
  expect(state.rows.some((row) => row.registrationNumber === 'NEW-BUS')).toBe(false);
  await expect(page.locator('mat-snack-bar-container')).toHaveText('Bus deleted.');
});

test('stale edits require review of the latest record and a fresh version before another save', async ({
  page,
}) => {
  const state = await busesApi(page);
  await page.goto('/buses');
  await openBusAction(page, 'Edit', 'DEMO-BUS-001');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton', { name: 'Passenger capacity' }).fill('44');
  Object.assign(state.rows[0], { capacity: 55, version: 1 });
  await dialog.getByRole('button', { name: 'Save bus', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Someone changed this bus');
  await expect(dialog.getByRole('button', { name: 'Save bus', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('spinbutton')).toHaveValue('44');
  await dialog.getByRole('button', { name: 'Reload latest bus' }).click();
  await expect(dialog.getByRole('spinbutton')).toHaveValue('55');
  await dialog.getByRole('spinbutton').fill('56');
  await dialog.getByRole('button', { name: 'Save bus', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(state.requests.filter((r) => r.method === 'PUT').at(-1)?.body?.['version']).toBe(1);
  state.failure = { method: 'DELETE', status: 409, code: 'BUS_IN_USE' };
  await openBusAction(page, 'Delete', 'DEMO-BUS-001');
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Deactivate it instead');
});

test('list failures allow retry; an uncertain write is not replayed; session expiry closes privileged UI', async ({
  page,
}) => {
  const state = await busesApi(page);
  state.failure = { method: 'GET', status: 503, code: 'INTERNAL_ERROR' };
  await page.goto('/buses');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('.bus-entry')).toHaveCount(20);
  await openBusAction(page, 'Edit', 'DEMO-BUS-001');
  state.dropWrite = true;
  await page.getByRole('dialog').getByRole('button', { name: 'Save bus', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('could not confirm');
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Save bus', exact: true }),
  ).toBeDisabled();
  expect(state.requests.filter((r) => r.method === 'PUT')).toHaveLength(1);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.bus-entry')).toHaveCount(20);
  state.dropWrite = false;
  state.failure = { method: 'PUT', status: 401, code: 'AUTHENTICATION_REQUIRED' };
  await openBusAction(page, 'Edit', 'DEMO-BUS-001');
  await page.getByRole('dialog').getByRole('button', { name: 'Save bus', exact: true }).click();
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Buses', exact: true })).toHaveCount(0);
});

test('loading overlays preserve rows and clear after reads, failed saves, reloads and deletion', async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = await busesApi(page);
  function pause(method: string) {
    let resume!: () => void;
    state.pause = { method, until: new Promise<void>((resolve) => (resume = resolve)) };
    return () => {
      state.pause = null;
      resume();
    };
  }
  let resume = pause('GET');
  await page.goto('/buses');
  const results = page.locator('.bus-results');
  const listOverlay = page.locator('app-loading-overlay.active').first();
  await expect(listOverlay).toBeVisible();
  await expect(results).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('.feedback')).toHaveText(en.buses.loading);
  await expect(listOverlay.locator('mat-spinner')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.getByText(en.buses.empty, { exact: true })).toHaveCount(0);
  resume();
  await expect(page.locator('app-loading-overlay.active')).toHaveCount(0);
  await expect(page.locator('.bus-entry')).toHaveCount(20);
  const height = (await results.boundingBox())!.height;
  resume = pause('GET');
  await page.getByRole('button', { name: en.buses.refresh, exact: true }).click();
  await expect(listOverlay).toBeVisible();
  await expect(page.locator('.bus-entry')).toHaveCount(20);
  expect((await results.boundingBox())!.height).toBe(height);
  await expect(page.getByRole('button', { name: en.buses.refresh, exact: true })).toBeDisabled();
  const indicator = await listOverlay.locator('.indicator').boundingBox();
  expect(indicator!.y).toBeGreaterThanOrEqual(0);
  expect(indicator!.y + indicator!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await info.attach('buses-loading-overlay', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  state.failure = { method: 'GET', status: 503, code: 'INTERNAL_ERROR' };
  resume();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('app-loading-overlay.active')).toHaveCount(0);
  await expect(results).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('.bus-entry')).toHaveCount(20);

  await openBusAction(page, 'Edit', 'DEMO-BUS-001');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton').fill('44');
  resume = pause('PUT');
  state.failure = { method: 'PUT', status: 409, code: 'BUS_VERSION_CONFLICT' };
  await dialog.getByRole('button', { name: en.buses.dialog.save, exact: true }).click();
  await expect(dialog.locator('app-loading-overlay.active')).toBeVisible();
  await expect(dialog.getByRole('status')).toHaveText(en.buses.dialog.saving);
  await expect(dialog.locator('form')).toHaveAttribute('aria-busy', 'true');
  await expect(dialog.locator('form [role="status"]')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: en.buses.dialog.cancel })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: en.buses.dialog.save })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  await info.attach('axe-buses-busy-dialog', {
    body: Buffer.from(
      JSON.stringify({ violations: audit.violations, manualReview: audit.incomplete }),
    ),
    contentType: 'application/json',
  });
  expect(audit.violations.map((violation) => violation.id)).toEqual([]);
  await info.attach('bus-dialog-loading-overlay', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  resume();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.locator('app-loading-overlay.active')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: en.buses.dialog.cancel })).toBeEnabled();
  resume = pause('GET');
  await dialog.getByRole('button', { name: en.buses.dialog.reload, exact: true }).click();
  await expect(dialog.locator('app-loading-overlay.active')).toBeVisible();
  await expect(dialog.getByRole('status')).toHaveText(en.buses.dialog.reloading);
  resume();
  await expect(dialog.locator('app-loading-overlay.active')).toHaveCount(0);
  await expect(dialog.getByRole('spinbutton')).toHaveValue('20');
  await dialog.getByRole('button', { name: en.buses.dialog.cancel, exact: true }).click();
  await openBusAction(page, 'Delete', 'DEMO-BUS-001');
  resume = pause('DELETE');
  await dialog.getByRole('button', { name: en.buses.dialog.confirmDelete, exact: true }).click();
  await expect(dialog.locator('app-loading-overlay.active')).toBeVisible();
  await expect(dialog.getByRole('button', { name: en.buses.dialog.confirmDelete })).toBeDisabled();
  resume();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('app-loading-overlay.active')).toHaveCount(0);
  await expect(page.locator('mat-snack-bar-container')).toHaveText(en.buses.saved.delete);
  expect(state.requests.filter((request) => request.method === 'PUT')).toHaveLength(1);
  expect(state.requests.filter((request) => request.method === 'DELETE')).toHaveLength(1);
});

for (const mode of ['Edit', 'Delete'] as const) {
  test(`${mode} cancellation preserves the page, records, focus and scroll without a request`, async ({
    page,
  }) => {
    const state = await busesApi(page);
    await page.goto('/buses');
    await expect(page.locator('.bus-entry')).toHaveCount(20);
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(page.locator('.bus-entry')).toHaveCount(10);
    const trigger = busActionTrigger(page, mode, 'DEMO-BUS-028');
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    const before = await page
      .locator('mat-sidenav-content')
      .evaluate((element) => element.scrollTop);
    const requestsBefore = state.requests.length;
    await openBusAction(page, mode, 'DEMO-BUS-028');
    const dialog = page.getByRole('dialog');
    if (mode === 'Edit') await dialog.getByRole('spinbutton').fill('99');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page.locator('.bus-entry')).toHaveCount(10);
    expect(state.requests).toHaveLength(requestsBefore);
    await expect(page.locator('mat-snack-bar-container')).toHaveCount(0);
    expect(state.rows.find((bus) => bus.registrationNumber === 'DEMO-BUS-028')?.capacity).not.toBe(
      99,
    );
    expect(state.requests.at(-1)?.url.searchParams.get('page')).toBe('1');
    const after = await page
      .locator('mat-sidenav-content')
      .evaluate((element) => element.scrollTop);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  });
}

test('a 320px screen keeps all table columns and long registrations readable with keyboard-operated actions', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const state = await busesApi(page);
  const registration = '000-LONG-REGISTRATION-1234567890'.slice(0, 32);
  state.rows[0]!.registrationNumber = registration;
  await page.goto('/buses');
  await expect(page.locator('.bus-entry')).toHaveCount(20);
  await expect(page.getByRole('columnheader')).toHaveCount(4);
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByText(registration, { exact: true })).toBeVisible();
  expect(
    await page
      .locator('.table-scroll')
      .evaluate((element) => element.scrollWidth > element.clientWidth + 1),
  ).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
    false,
  );
  const trigger = page.getByRole('button', { name: 'Actions for ' + registration, exact: true });
  await trigger.focus();
  const before = state.requests.length;
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue(registration);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(state.requests).toHaveLength(before);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

for (const language of ['en', 'de', 'ar'] as const) {
  for (const theme of ['light', 'dark']) {
    test(`buses table and dialog accessibility: ${language} / ${theme}`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await busesApi(page);
      await context.addCookies([
        { name: 'bus-management.appearance', value: theme, url: baseURL! },
      ]);
      await page.addInitScript(
        (lang) => localStorage.setItem('bus-management.language', lang),
        language,
      );
      await page.goto('/buses');
      await expect(page.locator('.bus-entry')).toHaveCount(20);
      await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
        false,
      );
      await expect(page.getByRole('table')).toBeVisible();
      await expect(page.getByRole('article')).toHaveCount(0);
      await page.locator('.table-scroll').focus();
      await expect(page.locator('.table-scroll')).toBeFocused();
      expect(
        await page
          .locator('.table-scroll')
          .evaluate((element) => element.scrollWidth > element.clientWidth + 1),
      ).toBe(false);
      const compact = page.viewportSize()!.width < 700;
      const labels = messages[language].buses;
      await expect(page.locator('.heading button')).toHaveAccessibleName(labels.add);
      await expect(page.locator('.filters button[type="submit"]')).toHaveAccessibleName(
        labels.submitSearch,
      );
      await expect(page.getByRole('button', { name: labels.refresh, exact: true })).toBeEnabled();
      const firstRow = page.locator('.bus-entry').first();
      if (compact) {
        const trigger = firstRow.getByRole('button');
        await expect(trigger).toHaveAccessibleName(
          labels.actionsFor.replace('{{registration}}', 'DEMO-BUS-001'),
        );
        await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      } else {
        const edit = firstRow.getByRole('button').nth(0);
        const remove = firstRow.getByRole('button').nth(1);
        await expect(edit).toHaveAccessibleName(
          labels.editBus.replace('{{registration}}', 'DEMO-BUS-001'),
        );
        await expect(remove).toHaveAccessibleName(
          labels.deleteBus.replace('{{registration}}', 'DEMO-BUS-001'),
        );
        await expect(edit).toHaveAccessibleDescription(labels.edit);
        await expect(remove).toHaveAccessibleDescription(labels.delete);
        // Material exposes the description separately from its aria-hidden visual tooltip.
        const tooltip = page.locator('mat-tooltip-component .mat-mdc-tooltip-surface');
        await edit.hover();
        await expect(tooltip).toHaveText(labels.edit);
        await expect(tooltip).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(tooltip).toBeHidden();
        await page.locator('.heading').hover();
        await edit.focus();
        await page.keyboard.press('Tab');
        await expect(remove).toBeFocused();
        await expect(remove).toHaveClass(/cdk-keyboard-focused/);
        await expect(tooltip).toHaveText(labels.delete);
        await expect(tooltip).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(tooltip).toBeHidden();
        await expect(remove).toBeFocused();
      }
      for (const svg of await page.locator('button app-icon svg').all()) {
        await expect(svg).toHaveAttribute('aria-hidden', 'true');
        await expect(svg).toHaveAttribute('focusable', 'false');
      }
      for (const state of compact ? ['table', 'menu', 'dialog'] : ['table', 'dialog']) {
        if (state === 'menu') {
          await page.locator('.bus-entry').first().getByRole('button').click();
          await expect(firstRow.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
          await expect(page.getByRole('menu')).toHaveAccessibleName(labels.actions);
          await expect(page.getByRole('menuitem').nth(0)).toHaveAccessibleName(labels.edit);
          await expect(page.getByRole('menuitem').nth(1)).toHaveAccessibleName(labels.delete);
          await expect(page.getByRole('menuitem').first()).toBeFocused();
          await page.getByRole('menu').evaluate(async (element) => {
            await Promise.allSettled(
              element.getAnimations({ subtree: true }).map((animation) => animation.finished),
            );
          });
        }
        if (state === 'dialog') {
          await page.locator('.heading button').click();
          await expect(page.locator('#bus-dialog-cancel')).toHaveAccessibleName(
            labels.dialog.cancel,
          );
          await expect(
            page.getByRole('dialog').locator('button[type="submit"]'),
          ).toHaveAccessibleName(labels.dialog.save);
          await expect(page.getByRole('dialog').getByRole('textbox')).toBeFocused();
          for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
          expect(
            await page
              .getByRole('dialog')
              .evaluate((element) => element.contains(document.activeElement)),
          ).toBe(true);
        }
        if (state === 'dialog') {
          await expect(page.getByRole('dialog').locator('mat-error').first()).toBeVisible();
          await page.getByRole('dialog').evaluate(async (element) => {
            await Promise.allSettled(
              element.getAnimations({ subtree: true }).map((animation) => animation.finished),
            );
          });
        }
        const scanner = new AxeBuilder({ page });
        const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
        // Material popups live outside page landmarks. Audit their WCAG semantics separately;
        // the table/dialog scans retain full-page landmark and other best-practice checks.
        if (state === 'menu') scanner.include('[role="menu"]').withTags(wcag);
        else scanner.withTags([...wcag, 'best-practice']);
        const result = await scanner.analyze();
        await info.attach(`axe-buses-${state}`, {
          body: Buffer.from(
            JSON.stringify({ violations: result.violations, manualReview: result.incomplete }),
          ),
          contentType: 'application/json',
        });
        expect(
          result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
        ).toEqual([]);
        if (state === 'menu') await page.keyboard.press('Escape');
      }
      await page.keyboard.press('Escape');
      await expect(page.locator('.heading button')).toBeFocused();
      await page.locator('.heading button').click();
      await page
        .getByRole('dialog')
        .getByRole('textbox')
        .fill('TOAST-' + language + '-' + theme);
      await page
        .getByRole('dialog')
        .getByRole('button', { name: messages[language].buses.dialog.save, exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const toast = page.locator('mat-snack-bar-container');
      await expect(toast).toHaveCount(1);
      await expect(toast).toHaveText(messages[language].buses.saved.create);
      await expect(toast).toHaveCSS('direction', language === 'ar' ? 'rtl' : 'ltr');
      await expect(page.locator('.heading button')).toBeFocused();
      await toast.evaluate(async (element) => {
        await Promise.allSettled(
          element.getAnimations({ subtree: true }).map((animation) => animation.finished),
        );
      });
      const toastScan = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze();
      await info.attach('axe-buses-toast', {
        body: Buffer.from(
          JSON.stringify({ violations: toastScan.violations, manualReview: toastScan.incomplete }),
        ),
        contentType: 'application/json',
      });
      expect(toastScan.violations.map((issue) => issue.id)).toEqual([]);
    });
  }
}
