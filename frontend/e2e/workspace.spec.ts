import AxeBuilder from '@axe-core/playwright';
import { test } from './fixtures';
import { expect, Page } from '@playwright/test';

async function navigateToPreferences(page: Page) {
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('link', { name: 'Preferences', exact: true }).click();
}

async function chooseLanguage(page: Page, label: string, choice: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: choice, exact: true }).click();
  // Text can update before Material finishes closing its previous overlay.
  await expect(page.getByRole('listbox')).toBeHidden();
}

test('opens the overview and supports navigation and nested-route reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Every trip, in view.');
  await navigateToPreferences(page);
  await expect(page).toHaveURL(/\/preferences$/);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Workspace preferences');
  expect(errors).toEqual([]);
});

test('page navigation shows the shared loading overlay until the lazy page is ready', async ({
  page,
}, info) => {
  await page.goto('/overview');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Every trip, in view.');
  let resume!: () => void;
  const pending = new Promise<void>((resolve) => (resume = resolve));
  let chunkRequested!: () => void;
  const started = new Promise<void>((resolve) => (chunkRequested = resolve));
  await page.route('**/*.js', async (route) => {
    const response = await route.fetch();
    // The unique preview marker identifies this lazy page in both dev and production bundles.
    if ((await response.text()).includes('number-preview')) {
      chunkRequested();
      await pending;
    }
    await route.fulfill({ response });
  });
  try {
    await navigateToPreferences(page);
    await started;
    const overlay = page.locator('main > app-loading-overlay');
    await expect(overlay).toHaveClass(/active/);
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveText('Loading page…');
    await expect(overlay).toHaveAttribute('role', 'status');
    await expect(overlay).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('main > div')).toHaveAttribute('aria-busy', 'true');
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    await info.attach('axe-page-navigation-loading', {
      body: Buffer.from(
        JSON.stringify({ violations: audit.violations, manualReview: audit.incomplete }),
      ),
      contentType: 'application/json',
    });
    expect(audit.violations.map((violation) => violation.id)).toEqual([]);
    resume();
    await expect(page).toHaveURL(/\/preferences$/);
    await expect(overlay).not.toHaveClass(/active/);
    await expect(page.locator('main > div')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Workspace preferences');
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    await expect(overlay).toHaveCSS('pointer-events', 'none');
    await page.getByRole('radio', { name: 'Dark', exact: true }).check();
    await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
  } finally {
    resume();
  }
});

test('switches language in place, formats examples and restores the choice after reload', async ({
  page,
}) => {
  await page.goto('/preferences');
  await chooseLanguage(page, 'Language', 'Deutsch');
  await expect(page).toHaveURL(/\/preferences$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Einstellungen');
  await expect(page.getByTestId('number-preview')).toHaveText('12.345,67');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Einstellungen');
  await chooseLanguage(page, 'Sprache', 'العربية');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('تفضيلات مساحة العمل');
  await expect(page.getByTestId('number-preview')).toHaveText('١٢٬٣٤٥٫٦٧');
  // Material's select overlay remains usable after changing direction.
  await chooseLanguage(page, 'اللغة', 'English');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

for (const choice of [
  { name: 'Deutsch', dir: 'ltr' },
  { name: 'العربية', dir: 'rtl' },
]) {
  test(`fits the viewport in ${choice.name}`, async ({ page }) => {
    await page.goto('/overview');
    await chooseLanguage(page, 'Language', choice.name);
    await expect(page.locator('html')).toHaveAttribute('dir', choice.dir);
    const overflow = await page.evaluate(() => {
      const content = document.querySelector('mat-sidenav-content');
      return (
        document.documentElement.scrollWidth > innerWidth + 1 ||
        (!!content && content.scrollWidth > content.clientWidth + 1)
      );
    });
    expect(overflow).toBe(false);
  });
}

test('provides a translated recovery route for unknown URLs', async ({ page }) => {
  await page.goto('/missing-page');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Let’s get you back on route.');
  await page.getByRole('link', { name: 'Back to overview' }).click();
  await expect(page).toHaveURL(/\/overview$/);
});
