// Optional real identity flow, invoked only by smoke-compose.py --browser-tests.
// Node 24 runs this TypeScript file directly; ordinary Playwright specs use isolated API fixtures.
import { chromium, devices, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

async function checkIdentityTheme(
  page: Page,
  state: string,
  language: string,
  preference: string,
  dark: boolean,
) {
  await expect(page.locator('html')).toHaveAttribute('lang', language);
  await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
  await expect(page.locator('html')).toHaveAttribute('data-theme', preference);
  if (dark) await expect(page.locator('html')).toHaveClass(/pf-v5-theme-dark/);
  else await expect(page.locator('html')).not.toHaveClass(/pf-v5-theme-dark/);
  await expect(page.locator('link[href*="/css/bus-management."]')).toHaveAttribute(
    'href',
    /\/css\/bus-management\.[0-9a-f]{12}\.css$/,
  );
  await expect(page.locator('body')).toHaveCSS(
    'background-color',
    dark ? 'rgb(16, 24, 32)' : 'rgb(245, 249, 252)',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
    false,
  );
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  await mkdir('test-results', { recursive: true });
  await writeFile(
    `test-results/keycloak-${state}-${language}-${preference}-axe.json`,
    JSON.stringify(
      {
        violations: result.violations,
        manualReview: result.incomplete,
      },
      null,
      2,
    ),
  );
  await page.screenshot({
    path: `test-results/keycloak-${state}-${language}-${preference}.png`,
    fullPage: true,
  });
  expect(
    result.violations.map((issue) => ({
      id: issue.id,
      nodes: issue.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

const base = process.env['PLAYWRIGHT_BASE_URL'];
const password = process.env['DEMO_USER_PASSWORD'];
if (!base || !password)
  throw new Error('The isolated Compose smoke must provide base URL and demo password');
const browser = await chromium.launch();

async function checkSwagger(page: Page, base: string) {
  await page.goto(base + '/api/docs');
  await expect(page.locator('.swagger-ui .info .title')).toContainText('Bus Management System API');
  const schemaResponse = await page.context().request.get(base + '/api/openapi');
  expect(schemaResponse.status()).toBe(200);
  await writeFile(
    'test-results/openapi.json',
    JSON.stringify(await schemaResponse.json(), null, 2),
  );

  const create = page.locator('#operations-Buses-createBus');
  await create.locator('.opblock-summary-control').click();
  await create.getByRole('button', { name: 'Try it out', exact: true }).click();
  await create.locator('textarea').fill(
    JSON.stringify({
      registrationNumber: 'SWAGGER-' + randomUUID().slice(0, 8),
      capacity: 40,
      active: true,
    }),
  );
  const createdResponse = page.waitForResponse(
    (response) =>
      response.url() === base + '/api/v1/buses' && response.request().method() === 'POST',
  );
  await create.getByRole('button', { name: 'Execute', exact: true }).click();
  const response = await createdResponse;
  expect(response.status()).toBe(201);
  const csrf = (await page.context().cookies(base)).find((cookie) => cookie.name === 'XSRF-TOKEN');
  expect(response.request().headers()['x-xsrf-token']).toBe(csrf?.value);
  const bus = await response.json();
  await page.screenshot({ path: 'test-results/swagger-buses.png', fullPage: true });

  const remove = page.locator('#operations-Buses-deleteBus');
  await remove.locator('.opblock-summary-control').click();
  await remove.getByRole('button', { name: 'Try it out', exact: true }).click();
  await remove.locator('tr[data-param-name="id"] input').fill(String(bus.id));
  await remove.locator('tr[data-param-name="version"] input').fill(String(bus.version));
  const deletedResponse = page.waitForResponse(
    (result) =>
      result.request().method() === 'DELETE' &&
      result.url().startsWith(base + '/api/v1/buses/' + bus.id),
  );
  await remove.getByRole('button', { name: 'Execute', exact: true }).click();
  expect((await deletedResponse).status()).toBe(204);
  await page.goto(base + '/account');
  console.log(
    'PASS: real session Swagger UI loads through the proxy and sends CSRF-protected create/delete requests',
  );
}

try {
  for (const entry of [
    { role: 'admin', language: 'en', login: 'Log in', logout: 'Log out', signup: 'Sign up' },
    {
      role: 'driver',
      language: 'de',
      login: 'Anmelden',
      logout: 'Abmelden',
      signup: 'Registrieren',
    },
    {
      role: 'passenger',
      language: 'ar',
      login: 'تسجيل الدخول',
      logout: 'تسجيل الخروج',
      signup: 'إنشاء حساب',
    },
  ]) {
    for (const preference of ['light', 'dark', 'system']) {
      const systemDark = entry.role !== 'driver';
      const dark = preference === 'dark' || (preference === 'system' && systemDark);
      const context = await browser.newContext({
        ...(entry.role === 'admin' ? {} : devices['Pixel 7']),
        colorScheme: systemDark ? 'dark' : 'light',
      });
      await context.addInitScript(
        (lang) => localStorage.setItem('bus-management.language', lang),
        entry.language,
      );
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(base + '/preferences');
      await page.locator(`mat-radio-button input[value="${preference}"]`).check();
      await expect(page.locator('html')).toHaveAttribute('data-theme', preference);
      await page.getByRole('link', { name: entry.login, exact: true }).click();
      await expect(page.locator('#username')).toBeVisible();
      await checkIdentityTheme(page, 'login', entry.language, preference, dark);
      // A live OS change affects System only and leaves partially entered form values intact.
      await page.locator('#username').fill('theme-preserves-input');
      await page.emulateMedia({ colorScheme: systemDark ? 'light' : 'dark' });
      await expect(page.locator('body')).toHaveCSS(
        'background-color',
        (preference === 'system' ? !systemDark : dark) ? 'rgb(16, 24, 32)' : 'rgb(245, 249, 252)',
      );
      await expect(page.locator('#username')).toHaveValue('theme-preserves-input');
      await page.emulateMedia({ colorScheme: systemDark ? 'dark' : 'light' });
      await page.locator('#username').fill('demo-' + entry.role);
      await page.keyboard.press('Tab');
      await expect(page.locator('#password')).toBeFocused();
      await page.locator('#password').fill('incorrect-theme-test-only');
      await page.keyboard.press('Tab');
      const toggle = page.locator('[data-password-toggle]');
      await expect(toggle).toBeFocused();
      await page.keyboard.press('Space');
      await expect(page.locator('#password')).toHaveAttribute('type', 'text');
      await page.keyboard.press('Space');
      await expect(page.locator('#password')).toHaveAttribute('type', 'password');
      await page.keyboard.press('Tab');
      await expect(page.locator('#kc-login')).toBeFocused();
      await expect(page.locator('#kc-login')).toHaveCSS('outline-style', 'solid');
      await page.keyboard.press('Enter');
      await expect(page.locator('#input-error-username')).toBeVisible();
      await checkIdentityTheme(page, 'login-error', entry.language, preference, dark);
      await page.locator('#username').fill('demo-' + entry.role);
      await page.locator('#password').fill(password);
      await Promise.all([page.waitForURL(base + '/overview'), page.locator('#kc-login').click()]);
      await expect(page.getByRole('button', { name: entry.logout, exact: true })).toBeEnabled();
      const response = await context.request.get(base + '/api/auth/me');
      expect(response.status()).toBe(200);
      expect((await response.json()).roles).toEqual([entry.role.toUpperCase()]);
      expect(
        (await context.cookies(base)).find((cookie) => cookie.name === 'JSESSIONID')?.httpOnly,
      ).toBe(true);
      await page.goto(base + '/administration');
      await expect(page).toHaveURL(
        base + (entry.role === 'admin' ? '/administration' : '/overview'),
      );
      await page.goto(base + '/driver');
      await expect(page).toHaveURL(base + (entry.role === 'passenger' ? '/overview' : '/driver'));
      await page.goto(base + '/account');
      await expect(page.locator('main')).toContainText('demo-' + entry.role);
      await page.screenshot({
        path: `test-results/real-account-${entry.role}.png`,
        fullPage: true,
      });
      if (entry.role === 'admin' && preference === 'light') await checkSwagger(page, base);
      await page.getByRole('button', { name: entry.logout, exact: true }).click();
      await page.waitForURL(base + '/overview');
      await expect(page.getByRole('link', { name: entry.login, exact: true })).toBeVisible();
      expect((await context.request.get(base + '/api/auth/me')).status()).toBe(401);
      await page.getByRole('link', { name: entry.login, exact: true }).click();
      await expect(page.locator('#kc-form-login')).toBeVisible();
      await page.goto(base + '/overview');
      await page.getByRole('link', { name: entry.signup, exact: true }).click();
      await expect(page.locator('#kc-register-form')).toBeVisible();
      await checkIdentityTheme(page, 'registration', entry.language, preference, dark);
      await page.locator('#kc-register-form [type="submit"]').click();
      await expect(page.locator('#username')).toHaveAttribute('aria-invalid', 'true');
      await checkIdentityTheme(page, 'registration-error', entry.language, preference, dark);
      expect(errors).toEqual([]);
      console.log(
        `PASS: real ${entry.role}/${entry.language} ${preference} UI login, route guards, session and browser/SSO logout`,
      );
      await context.close();
    }
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base + '/overview');
  await page.getByRole('link', { name: 'Sign up', exact: true }).click();
  const username = 'browser-' + randomUUID().slice(0, 8);
  await page.locator('#username').fill(username);
  await page.locator('#firstName').fill('Demo');
  await page.locator('#lastName').fill('Passenger');
  await page.locator('#email').fill(username + '@example.test');
  await page.locator('#password').fill(password);
  await page.locator('#password-confirm').fill(password);
  await Promise.all([
    page.waitForURL(base + '/overview'),
    page.locator('#kc-register-form [type="submit"]').click(),
  ]);
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeEnabled();
  const response = await context.request.get(base + '/api/auth/me');
  expect((await response.json()).roles).toEqual(['PASSENGER']);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
  console.log('PASS: real UI signup grants PASSENGER only and supports browser logout');
  await context.close();
} finally {
  await browser.close();
}
