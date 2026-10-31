// @ts-check
// Screenshot matrix for LOOKING at the UI (not assertions): one PNG per state × viewport × theme × season, written to SHOTS_OUT
// (default test-results/shots). Excluded from `npm run test:e2e` (definePlaywrightConfig ignores screens specs unless SHOTS is
// set); nothing is compared against a baseline (baselines drift across machines and fonts). Compare runs by eye: shoot before
// and after a change and read both sets.
import { test } from '@playwright/test'
import { VIEWPORTS, applyLook, looks, offline } from './look.js'

/** @typedef {(page: import('@playwright/test').Page) => Promise<void>} State */

/**
 * Register one test per state × look. Call once, at the top level of an `e2e/screens.spec.ts`.
 * @param {Record<string, State>} states
 * @param {{ out?: string }} [options]
 */
export function defineShots(states, options = {}) {
  const out = options.out ?? process.env.SHOTS_OUT ?? 'test-results/shots'
  for (const { viewport, theme, season } of looks()) {
    for (const [name, go] of Object.entries(states)) {
      test(`${name} · ${viewport} · ${theme} · ${season}`, async ({ page }) => {
        await page.setViewportSize(VIEWPORTS[viewport])
        await page.emulateMedia({ colorScheme: /** @type {'light' | 'dark'} */ (theme), reducedMotion: 'reduce' })
        await offline(page)
        await go(page)
        await applyLook(page, theme, season)
        // chromium keeps the plain name; other browsers get a suffix so runs never overwrite each other
        const project = test.info().project.name
        const tag = project === 'chromium' ? '' : `.${project}`
        await page.screenshot({ path: `${out}/${name}.${viewport}.${theme}.${season}${tag}.png`, fullPage: true })
      })
    }
  }
}
