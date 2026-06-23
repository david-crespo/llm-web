import { defineConfig, devices } from '@playwright/test'

// Tests run against their own dev server on a dedicated port (not the 5173 one a
// developer may already have running) so the suite is self-contained. Served
// over https (self-signed) because the app's CSP upgrades insecure requests and
// WebKit enforces that on localhost; ignoreHTTPSErrors accepts the cert.
const PORT = 4173
const baseURL = `https://localhost:${PORT}`

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // In CI, 'github' emits inline annotations and 'html' produces a report
  // artifact uploaded by the workflow (kept closed so it doesn't try to open a
  // browser on the runner).
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `PW_HTTPS=1 bunx vite dev --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
    ignoreHTTPSErrors: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      // iPhone is the primary target, so the mobile project runs real Safari
      // (WebKit) with iPhone viewport + touch, not Chromium.
      name: 'mobile-safari',
      use: { ...devices['iPhone 15 Pro'] },
    },
    {
      // Desktop Safari too, to catch WebKit-specific behavior on the wide layout.
      name: 'desktop-safari',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } },
    },
  ],
})
