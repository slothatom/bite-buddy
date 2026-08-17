import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end configuration.
 *
 * The app is tested on a phone viewport as well as a desktop one, because it is
 * used on both and the layouts diverge — the sidebar is replaced by a bottom
 * nav, and every control has to grow to a thumb-sized target.
 *
 * `PLAYWRIGHT_CHROMIUM_PATH` lets a sandboxed environment point at a
 * preinstalled browser instead of downloading one.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',

  use: {
    baseURL: 'http://localhost:4173/bite-buddy/',
    trace: 'on-first-retry',
    launchOptions: executablePath ? { executablePath } : {},
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], launchOptions: executablePath ? { executablePath } : {} },
    },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        // The iPhone profile defaults to WebKit. Chromium is the browser
        // available everywhere this runs, and the viewport, touch support and
        // coarse pointer — which is what the mobile assertions actually test —
        // come from the device descriptor regardless of engine.
        browserName: 'chromium',
        defaultBrowserType: 'chromium',
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],

  // Tests run against the production build, so the checks cover what actually
  // ships rather than the dev server's output. The build is part of the server
  // command deliberately: `preview` serves whatever is in dist/, so without it
  // a local run happily passes against a bundle that predates your changes.
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/bite-buddy/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
