import { defineConfig, devices } from '@playwright/test'

// Port 3100 rather than 3000 so a dev server you already have running is never
// killed or competed with by a test run.
const PORT = 3100
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // Financial UI: a test that only passes on the third try is a broken test.
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Builds and serves the real app. `reuseExistingServer` keeps repeat local
  // runs fast; CI always starts clean.
  webServer: {
    // NEXT_DIST_DIR keeps this server's build output away from the one a
    // normal `npm run dev` is using, so the two never corrupt each other.
    command: `NEXT_DIST_DIR=.next-e2e npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
