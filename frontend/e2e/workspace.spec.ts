import { expect, Page, test } from '@playwright/test';

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
