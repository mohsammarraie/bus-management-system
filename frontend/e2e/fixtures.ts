import { test as base } from '@playwright/test';

export const test = base.extend<{ anonymousSession: void }>({
  anonymousSession: [
    async ({ page }, use) => {
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          status: 401,
          json: { code: 'AUTHENTICATION_REQUIRED' },
        }),
      );
      await use();
    },
    { auto: true },
  ],
});
