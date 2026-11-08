import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { test } from './fixtures';

test('dark appearance reaches the language overlay and keeps keyboard focus', async ({
  page,
}, info) => {
  await page.goto('/preferences');
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  const language = page.getByRole('combobox', { name: 'Language', exact: true });
  await language.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  await info.attach('dark-overlay-axe', {
    body: Buffer.from(
      JSON.stringify({ violations: result.violations, manualReview: result.incomplete }),
    ),
    contentType: 'application/json',
  });
  expect(result.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(language).toBeFocused();
});

test('keyboard selection persists across reload and routes; system follows live device changes', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/preferences');
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'system');
  await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeChecked();
  await expect(root).toHaveCSS('background-color', 'rgb(16, 24, 32)');
  const light = page.getByRole('radio', { name: 'Light', exact: true });
  await light.focus();
  await page.keyboard.press('Space');
  await expect(light).toBeChecked();
  await expect(root).toHaveCSS('background-color', 'rgb(245, 249, 252)');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  await expect(root).toHaveCSS('background-color', 'rgb(16, 24, 32)');
  const cookie = (await context.cookies()).find(
    (item) => item.name === 'bus-management.appearance',
  );
  expect(cookie).toMatchObject({ value: 'dark', path: '/', sameSite: 'Lax', httpOnly: false });
  expect(cookie!.expires).toBeGreaterThan(Date.now() / 1000 + 300 * 24 * 60 * 60);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(root).toHaveCSS('background-color', 'rgb(16, 24, 32)');
  await page.goto('/overview');
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await page.goto('/preferences');
  await page.getByRole('radio', { name: 'System', exact: true }).check();
  await expect(root).toHaveCSS('background-color', 'rgb(245, 249, 252)');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveCSS('background-color', 'rgb(16, 24, 32)');
  await page.reload();
  await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeChecked();
});

test('invalid saved values fall back to system', async ({ page, context, baseURL }) => {
  await context.addCookies([
    { name: 'bus-management.appearance', value: 'unsupported', url: baseURL! },
  ]);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/preferences');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(16, 24, 32)');
});

test('appearance remains usable when browser cookie access is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'cookie', {
      get: () => {
        throw new Error('Cookies blocked');
      },
      set: () => {
        throw new Error('Cookies blocked');
      },
    });
  });
  await page.goto('/preferences');
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(16, 24, 32)');
});
