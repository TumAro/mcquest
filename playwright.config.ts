import { defineConfig, devices } from '@playwright/test'

/**
 * The e2e suite runs its own dev server on its own port, and never reuses one
 * that happens to be running.
 *
 * Port 5173 belongs to `npm run dev` — the server you keep open while working.
 * With `reuseExistingServer: true` on the same port, Playwright silently tested
 * whatever that server was serving: another checkout, an older build, a branch
 * you had moved off. Screenshots and passing assertions then described code that
 * was not the code under test, which is worse than a failure because it looks
 * like success.
 */
const PORT = Number(process.env.E2E_PORT ?? 5174)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Never inherit a stranger's server. --strictPort makes a port clash fail
    // loudly instead of silently sliding to the next free port.
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
