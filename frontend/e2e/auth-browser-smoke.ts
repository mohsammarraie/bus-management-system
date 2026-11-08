// Optional real identity flow, invoked only by smoke-compose.py --browser-tests.
// Node 24 runs this TypeScript file directly; ordinary Playwright specs use isolated API fixtures.
import { chromium, devices, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

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
    const context = await browser.newContext(entry.role === 'admin' ? {} : devices['Pixel 7']);
    await context.addInitScript(
      (lang) => localStorage.setItem('bus-management.language', lang),
      entry.language,
    );
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base + '/overview');
    await page.getByRole('link', { name: entry.login, exact: true }).click();
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
