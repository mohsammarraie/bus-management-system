import AxeBuilder from '@axe-core/playwright';
import { expect, Page } from '@playwright/test';
import { test } from './fixtures';

async function account(page: Page, roles: string[], username = 'demo-user') {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: 'demo-subject', username, roles } }),
  );
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({ json: { headerName: 'X-XSRF-TOKEN', token: 'masked-form-token' } }),
  );
}
async function navigation(page: Page) {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  return page.getByRole('navigation', { name: 'Main navigation', exact: true });
}

test('anonymous controls preserve the selected language for hosted login and signup', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('bus-management.language', 'ar'));
  await page.goto('/overview');
  await expect(page.getByRole('link', { name: 'تسجيل الدخول', exact: true })).toHaveAttribute(
    'href',
    '/api/auth/login?lang=ar',
  );
  await expect(page.getByRole('link', { name: 'إنشاء حساب', exact: true })).toHaveAttribute(
    'href',
    '/api/auth/signup?lang=ar',
  );
  await page.goto('/account');
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole('status')).toHaveText('سجّل الدخول لفتح هذه الصفحة.');
});

for (const role of ['PASSENGER', 'DRIVER', 'ADMIN']) {
  test(`${role} account survives reload and exposes only its assigned navigation`, async ({
    page,
  }) => {
    await account(page, [role]);
    await page.goto('/account');
    await expect(page.locator('h1')).toHaveText('My account');
    await page.reload();
    await expect(page.locator('h1')).toHaveText('My account');
    const nav = await navigation(page);
    await expect(nav.getByRole('link', { name: 'Administration', exact: true })).toHaveCount(
      role === 'ADMIN' ? 1 : 0,
    );
    await expect(nav.getByRole('link', { name: 'Driver workspace', exact: true })).toHaveCount(
      role === 'PASSENGER' ? 0 : 1,
    );
    await page.goto('/administration');
    await expect(page).toHaveURL(role === 'ADMIN' ? /\/administration$/ : /\/overview$/);
    await page.goto('/driver');
    await expect(page).toHaveURL(role === 'PASSENGER' ? /\/overview$/ : /\/driver$/);
  });
}

test('an expired session removes privileged navigation and offers login without a redirect loop', async ({
  page,
}) => {
  await account(page, ['ADMIN']);
  await page.goto('/account');
  await expect(page.locator('h1')).toHaveText('My account');
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, json: { code: 'AUTHENTICATION_REQUIRED' } }),
  );
  const nav = await navigation(page);
  await nav.getByRole('link', { name: 'Administration', exact: true }).click();
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole('status')).toHaveText(
    'Your session has ended. Log in again to continue.',
  );
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
});

test('backend outage is distinct from anonymous state and can be retried', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto('/overview');
  await expect(page.getByRole('status')).toHaveText(
    'We could not check your session. Check your connection and try again.',
  );
  await account(page, ['DRIVER']);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'My account: demo-user', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('keyboard logout uses a fresh CSRF form token and a browser POST', async ({ page }) => {
  await account(page, ['DRIVER']);
  let submitted = false;
  await page.route('**/api/auth/logout', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(new URLSearchParams(route.request().postData() ?? '').get('_csrf')).toBe(
      'masked-form-token',
    );
    submitted = true;
    await page.route('**/api/auth/me', (request) => request.fulfill({ status: 401, json: {} }));
    await route.fulfill({ status: 302, headers: { location: '/overview' } });
  });
  await page.goto('/account');
  const logout = page.getByRole('button', { name: 'Log out', exact: true });
  await expect(logout).toBeEnabled();
  for (let step = 0; step < 16; step++) {
    await page.keyboard.press('Tab');
    if (await logout.evaluate((element) => element === document.activeElement)) break;
  }
  await expect(logout).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
  expect(submitted).toBe(true);
});

for (const lang of ['en', 'de', 'ar']) {
  test(`signed-in account is accessible and reflows at 320px in ${lang}`, async ({
    page,
  }, info) => {
    await page.addInitScript(
      (language) => localStorage.setItem('bus-management.language', language),
      lang,
    );
    await account(page, ['ADMIN'], 'driver-with-a-long-username-for-layout-testing');
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('/account');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    await info.attach('account-accessibility', {
      body: JSON.stringify({ violations: result.violations, manualReview: result.incomplete }),
      contentType: 'application/json',
    });
    expect(result.violations).toEqual([]);
    expect(
      await page.evaluate(() => {
        const content = document.querySelector('mat-sidenav-content');
        return (
          document.documentElement.scrollWidth > innerWidth + 1 ||
          (!!content && content.scrollWidth > content.clientWidth + 1)
        );
      }),
    ).toBe(false);
  });
}

test('login failures display a translated message and logout preparation failure permits retry', async ({
  page,
}) => {
  await page.goto('/overview?auth=failed');
  await expect(page.getByRole('status')).toHaveText('Login was not completed. Please try again.');
  await account(page, ['DRIVER']);
  await page.goto('/account');
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ status: 503, json: {} }));
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(
    'We could not start logout. Check your connection and try again.',
  );
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeEnabled();
});

test('restoring a cached document rechecks the server session', async ({ page }) => {
  await account(page, ['ADMIN']);
  await page.goto('/account');
  await expect(page.locator('h1')).toHaveText('My account');
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: {} }));
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })),
  );
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
});
