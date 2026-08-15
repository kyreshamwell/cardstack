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
  // Two, not the CPU count.
  //
  // The bottleneck is the Next DEV server, not the machine: it compiles routes
  // on demand, and five workers navigating at once made it drop connections
  // (`ECONNRESET`, then `net::ERR_ABORTED` on goto) — tests that passed alone
  // and failed in the pack. Two workers is both stable across repeated runs
  // and FASTER end to end (~20s vs ~52s), because the server isn't thrashing.
  workers: 2,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',

  // 10s rather than the 5s default. Against a dev server that compiles routes
  // on demand, a first navigation to a cold route can take several seconds
  // before anything renders — that jitter is the environment, not the app, and
  // 5s put assertions right on the edge of it.
  expect: { timeout: 10_000 },

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
