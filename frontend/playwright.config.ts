import { defineConfig, devices } from '@playwright/test';

const externalBaseURL = process.env['PLAYWRIGHT_BASE_URL'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  globalTimeout: process.env['CI'] ? 5 * 60_000 : undefined,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: externalBaseURL ?? 'http://127.0.0.1:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } },
    },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: 'npm run start -- --host 127.0.0.1 --port 4200',
        url: 'http://127.0.0.1:4200',
        reuseExistingServer: !process.env['CI'],
        timeout: 60000,
      },
});
