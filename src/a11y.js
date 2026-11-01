// @ts-check
// The accessibility sweep every app runs, in one call: each state of the app (a route, a dialog open, an error page) in every colour mode
// × season at WCAG 2.2 AA and AAA, then at a 320 px reflow width, at 200% text size, in forced colours and with reduced motion, and a
// keyboard pass (every Tab stop is visible and shows where focus is). The assertions are exported on their own for specs that need one.
//
//   // e2e/a11y.spec.ts
//   defineA11ySuite({ home: async (page) => { await page.goto('/') }, empty: openEmpty }, { aaa: 'gate' })
import { expect, test } from '@playwright/test'
import { expectAccessible } from './axe.js'
import { applyLook, looks, offline } from './look.js'

/** @typedef {(page: import('@playwright/test').Page) => Promise<void>} State */

/**
 * The page has no horizontal scroll: nothing is wider than the viewport (WCAG 1.4.10 reflow, and 1.4.4 at a larger text size).
 * @param {import('@playwright/test').Page} page
 */
export async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'the page scrolls sideways by this many CSS pixels').toBeLessThanOrEqual(0)
}

/**
 * No animation is running: with `prefers-reduced-motion: reduce` the page holds still (WCAG 2.3.3).
 * @param {import('@playwright/test').Page} page
 */
export async function expectNoRunningAnimations(page) {
  await page.waitForTimeout(250)
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').map((a) => (/** @type {KeyframeEffect | null} */ (a.effect)?.target?.className || 'animation')))
  expect(running, 'animations still running under reduced motion').toEqual([])
}

/**
 * What the focused element looks like: visible, shows an indicator, and is not hidden behind other content. Runs in the page.
 * @param {import('@playwright/test').Page} page
 */
async function probeFocus(page) {
  return page.evaluate(() => {
    const el = document.activeElement
    if (!el || el === document.body) return null
    // A visually hidden control (a radio or checkbox inside its label) shows focus on its label, so that is what is checked.
    const tiny = el.getBoundingClientRect().width < 4 || el.getBoundingClientRect().height < 4
    const target = tiny ? (el.closest('label') ?? el.parentElement ?? el) : el
    const box = target.getBoundingClientRect()
    const shows = (/** @type {Element} */ node) => {
      const style = getComputedStyle(node)
      return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none'
    }
    const indicator = shows(target) || (!tiny && shows(el)) || ['::before', '::after'].some((p) => {
      const s = getComputedStyle(target, p)
      return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none'
    })
    // WCAG 2.4.11 (focus not obscured): once focus has scrolled the stop into view, it is not entirely hidden behind sticky or fixed
    // content. Five points are sampled (the centre and four inset corners of the part inside the viewport); hidden means all are covered.
    const x0 = Math.max(box.left, 0)
    const x1 = Math.min(box.right, innerWidth)
    const y0 = Math.max(box.top, 0)
    const y1 = Math.min(box.bottom, innerHeight)
    const inView = x1 > x0 && y1 > y0
    const samples = [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]
    const obscured = inView && samples.every(([fx, fy]) => {
      const top = document.elementFromPoint(x0 + (x1 - x0) * /** @type {number} */ (fx), y0 + (y1 - y0) * /** @type {number} */ (fy))
      return !!top && !target.contains(top) && !top.contains(target)
    })
    const label = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''} "${(target.textContent ?? '').trim().slice(0, 24)}"`
    return { label, visible: box.width > 0 && box.height > 0, indicator, obscured }
  })
}

/**
 * Tab through the page: every stop is visible, shows a focus indicator (an outline or a shadow) and is not hidden behind sticky or fixed
 * content, and the tab order ends (no trap). Then Shift+Tab back through it, so a stop reached from below is checked as well (browsers
 * scroll a stop into view from the side it arrives from, so a sticky header or a bottom bar can cover it in only one direction).
 * @param {import('@playwright/test').Page} page
 * @param {{ maxStops?: number }} [options]
 */
export async function expectKeyboardFocusVisible(page, { maxStops = 120 } = {}) {
  /** @type {string[]} */
  const problems = []
  let stops = 0
  const seen = new Set()
  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press('Tab')
    const stop = await probeFocus(page)
    if (!stop) break // focus left the document: the cycle is complete
    const key = stop.label
    if (seen.has(key) && seen.size > 1 && i > seen.size + 1) break
    seen.add(key)
    stops++
    if (!stop.visible) problems.push(`${stop.label} takes focus but is not visible`)
    if (!stop.indicator) problems.push(`${stop.label} shows no focus indicator`)
    if (stop.obscured) problems.push(`${stop.label} is hidden behind other content when focused (WCAG 2.4.11: add scroll-padding for sticky chrome)`)
  }
  expect(stops, 'the page has no keyboard stops').toBeGreaterThan(0)
  for (let i = 0; i < Math.min(stops, maxStops); i++) {
    await page.keyboard.press('Shift+Tab')
    const stop = await probeFocus(page)
    if (!stop) break
    if (stop.obscured) problems.push(`${stop.label} is hidden behind other content when reached backwards (WCAG 2.4.11: add scroll-padding for sticky chrome)`)
  }
  expect([...new Set(problems)]).toEqual([])
}

/**
 * @param {Record<string, State>} states Opens each state of the app (navigates, mocks, opens the dialog).
 * @param {{ aaa?: 'gate' | 'report' | 'off' }} [options] How WCAG AAA findings are treated (default `report`; a repo moves to `gate`
 *   in the release that clears them).
 */
export function defineA11ySuite(states, { aaa = 'report' } = {}) {
  for (const [name, open] of Object.entries(states)) {
    test.describe(name, () => {
      test.beforeEach(async ({ page }) => {
        await offline(page)
      })

      for (const { theme, season } of looks().filter((l) => l.viewport === 'desktop')) {
        test(`WCAG 2.2 AA and AAA (${theme} · ${season})`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: /** @type {'light' | 'dark'} */ (theme), reducedMotion: 'reduce' })
          await open(page)
          await applyLook(page, theme, season)
          await expectAccessible(page, { aaa })
        })
      }

      test('reflows at 320 CSS pixels', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 640 })
        await open(page)
        await expectNoHorizontalScroll(page)
        await expectAccessible(page, { aaa: 'off' })
      })

      test('holds at 200% text size', async ({ page }) => {
        await open(page)
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
        await expectNoHorizontalScroll(page)
        await expectAccessible(page, { aaa: 'off' })
      })

      test('works in forced colours', async ({ page }) => {
        await page.emulateMedia({ forcedColors: 'active' })
        await open(page)
        // The browser chooses the colours in forced-colours mode, so axe's contrast arithmetic on the declared ones does not apply.
        await expectAccessible(page, { aaa: 'off', disableRules: ['color-contrast'] })
      })

      test('holds still with reduced motion', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await open(page)
        await expectNoRunningAnimations(page)
      })

      test('can be used from the keyboard, and shows where focus is', async ({ page }) => {
        await open(page)
        await expectKeyboardFocusVisible(page)
      })
    })
  }
}
