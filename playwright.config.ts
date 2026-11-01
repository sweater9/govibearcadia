import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

// Tests run against the production build served by the real Workers runtime (`wrangler dev`): the static
// assets exactly as deployed, plus the /api Worker and Durable Objects. The service worker, code-splitting
// and offline behaviour only exist in a production build.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // A fresh state directory every run, so leaderboard and room data from earlier runs can never leak into a test.
    command: `npm run build && rm -rf .wrangler/e2e-state && WRANGLER_SEND_METRICS=false npx wrangler dev --port ${PORT} --ip localhost --persist-to .wrangler/e2e-state`,
    url: `http://localhost:${PORT}`,
    // Always build and serve fresh. Reusing a running server would silently test a stale build.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
