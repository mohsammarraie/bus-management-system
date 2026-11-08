// Optional real identity flow, invoked only by smoke-compose.py --browser-tests.
// Node 24 runs this TypeScript file directly; ordinary Playwright specs use isolated API fixtures.
import { chromium, devices, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

async function checkIdentityTheme(page: Page, state: string, language: string) {
  await expect(page.locator('html')).toHaveAttribute('lang', language);
  await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
  await expect(page.locator('html')).not.toHaveClass(/pf-v5-theme-dark/);
  await expect(page.locator('link[href*="css/bus-management.css"]')).toHaveCount(1);
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bms-primary').trim(),
    ),
  ).toBe('#006799');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(
    false,
  );
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  await mkdir('test-results', { recursive: true });
  await writeFile(
    `test-results/keycloak-${state}-${language}-axe.json`,
    JSON.stringify(
      {
        violations: result.violations,
        manualReview: result.incomplete,
      },
      null,
      2,
    ),
  );
  await page.screenshot({ path: `test-results/keycloak-${state}-${language}.png`, fullPage: true });
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
    const context = await browser.newContext(
      entry.role === 'admin' ? { colorScheme: 'dark' } : devices['Pixel 7'],
    );
    await context.addInitScript(
      (lang) => localStorage.setItem('bus-management.language', lang),
      entry.language,
    );
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base + '/overview');
    await page.getByRole('link', { name: entry.login, exact: true }).click();
    await expect(page.locator('#username')).toBeVisible();
    await checkIdentityTheme(page, 'login', entry.language);
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
    await checkIdentityTheme(page, 'login-error', entry.language);
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
    await expect(page).toHaveURL(base + (entry.role === 'admin' ? '/administration' : '/overview'));
    await page.goto(base + '/driver');
    await expect(page).toHaveURL(base + (entry.role === 'passenger' ? '/overview' : '/driver'));
    await page.goto(base + '/account');
    await expect(page.locator('main')).toContainText('demo-' + entry.role);
    await page.screenshot({ path: `test-results/real-account-${entry.role}.png`, fullPage: true });
    await page.getByRole('button', { name: entry.logout, exact: true }).click();
    await page.waitForURL(base + '/overview');
    await expect(page.getByRole('link', { name: entry.login, exact: true })).toBeVisible();
    expect((await context.request.get(base + '/api/auth/me')).status()).toBe(401);
    await page.getByRole('link', { name: entry.login, exact: true }).click();
    await expect(page.locator('#kc-form-login')).toBeVisible();
    await page.goto(base + '/overview');
    await page.getByRole('link', { name: entry.signup, exact: true }).click();
    await expect(page.locator('#kc-register-form')).toBeVisible();
    await checkIdentityTheme(page, 'registration', entry.language);
    await page.locator('#kc-register-form [type="submit"]').click();
    await expect(page.locator('#username')).toHaveAttribute('aria-invalid', 'true');
    await checkIdentityTheme(page, 'registration-error', entry.language);
    expect(errors).toEqual([]);
    console.log(
      `PASS: real ${entry.role}/${entry.language} UI login, route guards, session and browser/SSO logout`,
    );
    await context.close();
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
