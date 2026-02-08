import { defineConfig } from '@playwright/test';

const baseURL = process.env.COM_UI_BASE_URL || 'https://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL,
    headless: true,
    viewport: { width: 1365, height: 900 },
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
