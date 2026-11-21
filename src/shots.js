// @ts-check
// Screenshot matrix for LOOKING at the UI (not assertions): one PNG per state × viewport × theme × season, written to SHOTS_OUT
// (default test-results/shots). Excluded from `npm run test:e2e` (definePlaywrightConfig ignores screens specs unless SHOTS is
// set); nothing is compared against a baseline (baselines drift across machines and fonts). Compare runs by eye: shoot before
// and after a change and read both sets.
import { test } from '@playwright/test'
import { VIEWPORTS, applyLook, looks, offline } from './look.js'

/** @typedef {(page: import('@playwright/test').Page) => Promise<void>} State A function that brings the page to one state (navigates, opens a dialog). */

/**
 * Register one test per state × look. Call once, at the top level of an `e2e/screens.spec.ts`.
 * @param {Record<string, State>} states - the states to photograph, by name (the name is part of the file name)
 * @param {{ out?: string }} [options] - `out`: the directory the PNGs go to (default `SHOTS_OUT`, else `test-results/shots`)
 */
export function defineShots(states, options = {}) {
  // The output directory: an option beats the environment, which beats the default (a CI job sets SHOTS_OUT to collect them).
  const out = options.out ?? process.env.SHOTS_OUT ?? 'test-results/shots'
  // One test per look and per state, so a failure names the exact combination.
  for (const { viewport, theme, season } of looks()) {
    for (const [name, go] of Object.entries(states)) {
      test(`${name} · ${viewport} · ${theme} · ${season}`, async ({ page }) => {
        await page.setViewportSize(VIEWPORTS[viewport])
        // Reduced motion, so a screenshot never catches a transition half way.
        await page.emulateMedia({ colorScheme: /** @type {'light' | 'dark'} */ (theme), reducedMotion: 'reduce' })
        // No request leaves localhost: a screenshot of the app, not of whatever a third party answered that day.
        await offline(page)
        await go(page)
        // The look is applied after the state, so a state that navigates cannot reset it.
        await applyLook(page, theme, season)
        // chromium keeps the plain name; other browsers get a suffix so runs never overwrite each other
        const project = test.info().project.name
        const tag = project === 'chromium' ? '' : `.${project}`
        // fullPage: the whole scroll height, so a layout problem below the fold is visible too.
        await page.screenshot({ path: `${out}/${name}.${viewport}.${theme}.${season}${tag}.png`, fullPage: true })
      })
    }
  }
}
