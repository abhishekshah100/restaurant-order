import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// Run `npm run build` first: the tests serve the static export in out/.

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    // Uses installed Google Chrome; override with PW_CHANNEL (e.g. 'chromium' in CI).
    channel: process.env.PW_CHANNEL ?? 'chrome',
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    command: `npx serve out -l ${PORT} --no-clipboard`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
