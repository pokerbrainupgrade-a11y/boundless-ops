import { defineConfig, devices } from '@playwright/test';

const LIVE = process.env.E2E_BASE_URL; // e.g. https://pokerbrainupgrade-a11y.github.io
const baseURL = LIVE ?? 'http://localhost:4174';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    ...devices['iPhone 13'],
    browserName: 'chromium',
    serviceWorkers: 'allow',
  },
  webServer: LIVE
    ? undefined
    : {
        command: 'npx vite preview --port 4174 --strictPort',
        url: 'http://localhost:4174/boundless-ops/',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
