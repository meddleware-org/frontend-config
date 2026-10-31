// @ts-check
// Playwright config for browser tests of a BUILT app, gallery or VitePress site. A repo's playwright.config.ts becomes
//   import { definePlaywrightConfig } from '@meddleware/frontend-config/playwright'
//   export default definePlaywrightConfig({ port: 4281 })
//
// Browsers: Chromium locally (fast); all five projects in CI — Chromium, Firefox, WebKit and a Pixel 7 / iPhone 14 viewport
// (Chromium and WebKit engines). Override with E2E_BROWSERS=chromium|all (or the `browsers` option).
// Screenshot capture (`npm run shots`, SHOTS=1) is for looking, not asserting: screens specs only run when asked, and then alone.
import { defineConfig, devices } from '@playwright/test'

/** @typedef {'chromium' | 'all'} BrowserSet */

/**
 * @param {object} options
 * @param {number} options.port Preview server port (unique per repo, so repos can run side by side).
 * @param {'app' | 'gallery' | 'vitepress'} [options.kind] What is served. `app`: `npm run build` then `vite preview`.
 *   `gallery`: `npm run build:gallery` then `vite preview --config vite.gallery.config.ts`. `vitepress`: `vitepress preview docs`
 *   (the site must already be built, so the repo's `test:e2e` script builds first).
 * @param {string} [options.command] Full server command; replaces the one `kind` implies.
 * @param {BrowserSet} [options.browsers] Browser set; default from E2E_BROWSERS, else `all` in CI and `chromium` otherwise.
 * @param {string} [options.testDir]
 * @param {import('@playwright/test').PlaywrightTestConfig} [options.extra] Merged over the defaults.
 */
export function definePlaywrightConfig({ port, kind = 'app', command, browsers, testDir = './e2e', extra = {} }) {
  const server = {
    app: `npm run build && npx vite preview --port ${port} --strictPort`,
    gallery: `npm run build:gallery && npx vite preview --config vite.gallery.config.ts --port ${port} --strictPort`,
    vitepress: `npx vitepress preview docs --port ${port}`,
  }[kind]
  const requested = browsers ?? process.env.E2E_BROWSERS ?? (process.env.CI && !process.env.SHOTS ? 'all' : 'chromium')
  const all = requested === 'all'
  const projects = [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ...(all
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
          { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
          { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
        ]
      : []),
  ]
  return defineConfig({
    testDir,
    // A screenshot run loads only the screens specs; a normal run never loads them. (Tests are attributed to the file that calls
    // `test()`, which for `defineShots` is shots.js, so a `playwright test e2e/screens.spec.ts` file filter would find none.)
    ...(process.env.SHOTS ? { testMatch: '**/screens.spec.ts' } : { testIgnore: ['**/screens.spec.ts'] }),
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: { baseURL: `http://localhost:${port}`, viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' },
    webServer: {
      command: command ?? server,
      url: `http://localhost:${port}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    projects,
    ...extra,
  })
}
