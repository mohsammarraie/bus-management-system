import { test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { expect, Locator, Page, TestInfo } from '@playwright/test';

const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

async function checkAccessibility(page: Page, info: TestInfo, scope?: string) {
  let builder = new AxeBuilder({ page }).withTags(tags);
  if (scope) builder = builder.include(scope);
  const result = await builder.analyze();
  await info.attach(scope ? 'axe-navigation' : 'axe-page', {
    body: Buffer.from(
      JSON.stringify({ violations: result.violations, manualReview: result.incomplete }, null, 2),
    ),
    contentType: 'application/json',
  });
  expect(
    result.violations.map((issue) => ({
      id: issue.id,
      nodes: issue.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

async function tabTo(page: Page, target: Locator) {
  for (let step = 0; step < 8; step++) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  await expect(target).toBeFocused();
}

for (const language of ['en', 'de', 'ar']) {
  for (const theme of ['light', 'dark']) {
    for (const route of ['overview', 'preferences', 'missing-page']) {
      test(`accessibility scan: ${language} / ${route} / ${theme}`, async ({
        page,
        context,
        baseURL,
      }, info) => {
        await context.addCookies([
          { name: 'bus-management.appearance', value: theme, url: baseURL! },
        ]);
        await page.addInitScript(
          (lang) => localStorage.setItem('bus-management.language', lang),
          language,
        );
        await page.goto(`/${route}`);
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', language);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await checkAccessibility(page, info);
      });
    }
  }
}

test('first Tab reaches the visible skip link and Enter skips content without changing route', async ({
  page,
}) => {
  await page.goto('/preferences');
  await expect(page.locator('h1')).toBeVisible();
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content', exact: true });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await expect(skip).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  const main = page.getByRole('main', { name: 'Workspace preferences', exact: true });
  await expect(main).toBeFocused();
  await expect(page).toHaveURL(/\/preferences$/);
});

for (const labels of [
  {
    language: 'en',
    open: 'Open navigation',
    close: 'Close navigation',
    navigation: 'Main navigation',
    preferences: 'Preferences',
    heading: 'Workspace preferences',
    title: 'Workspace preferences | Bus Management',
    languageLabel: 'Language',
  },
  {
    language: 'ar',
    open: 'فتح قائمة التنقل',
    close: 'إغلاق قائمة التنقل',
    navigation: 'التنقل الرئيسي',
    preferences: 'التفضيلات',
    heading: 'تفضيلات مساحة العمل',
    title: 'تفضيلات مساحة العمل | إدارة الحافلات',
    languageLabel: 'اللغة',
  },
]) {
  test(`keyboard navigation, menu focus and Escape in ${labels.language}`, async ({
    page,
    isMobile,
  }, info) => {
    await page.addInitScript(
      (lang) => localStorage.setItem('bus-management.language', lang),
      labels.language,
    );
    await page.goto('/overview');
    await expect(page.locator('h1')).toBeVisible();
    if (isMobile) {
      const trigger = page.getByRole('button', {
        name: labels.open,
        exact: true,
        includeHidden: true,
      });
      await tabTo(page, trigger);
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', { name: labels.navigation, exact: true });
      await expect(dialog).toBeVisible();
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByRole('button', { name: labels.close, exact: true })).toBeFocused();
      await expect(page.locator('mat-sidenav-content')).toHaveJSProperty('inert', true);
      for (const key of ['Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab']) {
        await page.keyboard.press(key);
        expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
          true,
        );
      }
      await checkAccessibility(page, info, '#workspace-navigation');
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('Enter');
      await expect(dialog).toBeVisible();
      await expect(page.getByRole('button', { name: labels.close, exact: true })).toBeFocused();
    }
    const preferences = page.getByRole('link', {
      name: labels.preferences,
      exact: true,
      includeHidden: true,
    });
    await tabTo(page, preferences);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/preferences$/);
    await expect(page.getByRole('heading', { name: labels.heading, level: 1 })).toBeFocused();
    await expect(page).toHaveTitle(labels.title);
    await expect(preferences).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Shift+Tab');
    await expect(
      page.getByRole('combobox', { name: labels.languageLabel, exact: true }),
    ).toBeFocused();
  });
}

test('keyboard language selection updates titles and direction without stealing focus', async ({
  page,
}, info) => {
  await page.goto('/preferences');
  await expect(page.locator('h1')).toBeVisible();
  await tabTo(page, page.getByRole('combobox', { name: 'Language', exact: true }));
  await page.keyboard.press('Enter');
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible();
  const popupId = await listbox.getAttribute('id');
  expect(popupId).toBeTruthy();
  await expect(page.getByRole('combobox', { name: 'Language', exact: true })).toHaveAttribute(
    'aria-controls',
    popupId!,
  );
  await checkAccessibility(page, info);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeHidden();
  const german = page.getByRole('combobox', { name: 'Sprache', exact: true });
  await expect(german).toBeFocused();
  await expect(page).toHaveTitle('Einstellungen | Busverwaltung');
  await page.keyboard.press('Enter');
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeHidden();
  const arabic = page.getByRole('combobox', { name: 'اللغة', exact: true });
  await expect(arabic).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page).toHaveTitle('تفضيلات مساحة العمل | إدارة الحافلات');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(arabic).toBeFocused();
});

test('German preferences reflow at 320 CSS pixels with increased text spacing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.addInitScript(() => localStorage.setItem('bus-management.language', 'de'));
  await page.goto('/preferences');
  await expect(page.locator('h1')).toBeVisible();
  await page.addStyleTag({
    content:
      '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-block-end: 2em !important; }',
  });
  expect(
    await page.evaluate(() => {
      const content = document.querySelector('mat-sidenav-content');
      return (
        document.documentElement.scrollWidth > innerWidth + 1 ||
        (!!content && content.scrollWidth > content.clientWidth + 1)
      );
    }),
  ).toBe(false);
  await page.getByRole('combobox', { name: 'Sprache', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Deutsch', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 320, height: 256 });
  await page.getByRole('button', { name: 'Navigation öffnen', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Navigation schließen', exact: true }),
  ).toBeInViewport({ ratio: 1 });
  const navigation = page.getByRole('dialog', { name: 'Hauptnavigation', exact: true });
  expect(
    await navigation.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);
  const planned = await navigation.locator('.planned-nav').boundingBox();
  const footer = await navigation.locator('.sidebar-footer').boundingBox();
  expect(planned).not.toBeNull();
  expect(footer).not.toBeNull();
  expect(footer!.y).toBeGreaterThanOrEqual(planned!.y + planned!.height);
  await navigation.locator('.sidebar-footer').scrollIntoViewIfNeeded();
  // Allow subpixel scroll rounding around the footer's padded box.
  await expect(navigation.locator('.sidebar-footer')).toBeInViewport({ ratio: 0.99 });
});

for (const language of ['en', 'de', 'ar']) {
  test(`shared typography supports doubled root text size in ${language}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.addInitScript(
      (lang) => localStorage.setItem('bus-management.language', lang),
      language,
    );
    await page.goto('/preferences');
    const intro = page.locator('.page-intro');
    await expect(intro).toBeVisible();
    await expect(intro).toHaveCSS('font-size', '16px');
    await expect(page.locator('h2').first()).toHaveCSS('font-size', '20px');
    await expect(page.locator('.saved').first()).toHaveCSS('font-size', '13px');
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    await expect(intro).toHaveCSS('font-size', '32px');
    await expect(page.locator('h2').first()).toHaveCSS('font-size', '40px');
    await expect(page.locator('.saved').first()).toHaveCSS('font-size', '26px');
    // Material controls use the same family and also scale with the root font size.
    await expect(page.locator('mat-radio-button label').first()).toHaveCSS('font-size', '28px');
    await expect(page.locator('mat-radio-button label').first()).toHaveCSS(
      'font-family',
      'Arial, Tahoma, sans-serif',
    );
    expect(
      await page
        .locator('mat-sidenav-content')
        .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
    ).toBe(true);
  });
}
