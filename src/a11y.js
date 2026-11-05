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

/** @typedef {(page: import('@playwright/test').Page) => Promise<void>} Open */
/** @typedef {Open | { open: Open, disableRules?: string[] }} State A state is how to open it, or that and the axe rules that do not apply to it (a lone dialog has no landmarks). */

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
  // A browser may animate the scroll that brings the focused control into view (WebKit does, and `scroll-behavior: smooth` makes the
  // others): judge where it comes to rest, not where it passes through.
  await page.evaluate(
    () =>
      new Promise((done) => {
        let last = [scrollX, scrollY]
        let still = 0
        let frames = 0
        const tick = () => {
          const now = [scrollX, scrollY]
          if (now[0] === last[0] && now[1] === last[1]) still++
          else {
            still = 0
            last = now
          }
          if (still >= 3 || ++frames > 60) done(undefined)
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
  )
  return page.evaluate(() => {
    const el = document.activeElement
    // Once Tab has left the last control, Firefox hands focus to the browser's own chrome: the document no longer has focus, yet
    // `activeElement` still names the control it left. That is the end of the tab order, not a stop.
    if (!el || el === document.body || !document.hasFocus()) return null
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
    /** @type {Element | null} */
    let cover = null
    const obscured = inView && samples.every(([fx, fy]) => {
      const top = document.elementFromPoint(x0 + (x1 - x0) * /** @type {number} */ (fx), y0 + (y1 - y0) * /** @type {number} */ (fy))
      cover = top
      return !!top && !target.contains(top) && !top.contains(target)
    })
    const coveredBy = obscured && cover ? `${/** @type {Element} */ (cover).tagName.toLowerCase()}${/** @type {Element} */ (cover).id ? `#${/** @type {Element} */ (cover).id}` : ''}${/** @type {Element} */ (cover).className && typeof (/** @type {Element} */ (cover).className) === 'string' ? `.${String(/** @type {Element} */ (cover).className).trim().split(/\s+/).slice(0, 2).join('.')}` : ''}` : ''
    // The walk is complete when focus comes back to an element it has already stopped on: elements are compared by identity (two links can
    // share a label, as the same link often appears in a menu and in a sidebar), through a set the walk resets at its start.
    const seen = /** @type {{ __mwSeen?: WeakSet<Element> }} */ (/** @type {unknown} */ (window)).__mwSeen
    const repeat = !!seen && seen.has(el)
    seen?.add(el)
    const label = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''} "${(target.textContent ?? '').trim().slice(0, 24)}"`
    return { label, visible: box.width > 0 && box.height > 0, indicator, obscured, coveredBy, repeat }
  })
}

/**
 * Put the keyboard at the start of the document: nothing focused, the pointer out of the way, and the point sequential navigation continues
 * from at the top (a button that was just clicked is where the next Tab would otherwise start).
 * @param {import('@playwright/test').Page} page
 */
async function startAtTop(page) {
  // The pointer where an earlier click left it would keep a hover tooltip open over the controls the keyboard walk is about to reach.
  await page.mouse.move(0, 0)
  await page.evaluate(() => {
    ;/** @type {{ __mwSeen?: WeakSet<Element> }} */ (/** @type {unknown} */ (window)).__mwSeen = new WeakSet()
    const active = document.activeElement
    if (active instanceof HTMLElement && active !== document.body) active.blur()
    const selection = getSelection()
    if (!selection) return
    selection.removeAllRanges()
    const range = document.createRange()
    range.setStart(document.body, 0)
    range.collapse(true)
    selection.addRange(range)
  })
}

/**
 * Tab through the page: every stop is visible, shows a focus indicator (an outline or a shadow) and is not hidden behind sticky or fixed
 * content, and the tab order ends (no trap). Then Shift+Tab back through it, so a stop reached from below is checked as well (browsers
 * scroll a stop into view from the side it arrives from, so a sticky header or a bottom bar can cover it in only one direction).
 * @param {import('@playwright/test').Page} page
 * @param {{ maxStops?: number }} [options]
 */
export async function expectKeyboardFocusVisible(page, { maxStops = 300 } = {}) {
  /** @type {string[]} */
  const problems = []
  let stops = 0
  let wrapped = false
  let finished = false
  await startAtTop(page)
  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press('Tab')
    const stop = await probeFocus(page)
    if (!stop) {
      // Focus left the document: the cycle is complete. But a page that is reached with focus already on its last control (a button just
      // clicked) leaves on the first Tab, before any stop was seen: that press only wraps round to the start.
      if (stops === 0 && !wrapped) {
        wrapped = true
        continue
      }
      finished = true
      break
    }
    if (stop.repeat) {
      finished = true // back at a stop already seen: a focus cycle (a modal dialog holds focus inside itself), so the walk is complete
      break
    }
    stops++
    if (!stop.visible) problems.push(`${stop.label} takes focus but is not visible`)
    if (!stop.indicator) problems.push(`${stop.label} shows no focus indicator`)
    if (stop.obscured) problems.push(`${stop.label} is hidden behind ${stop.coveredBy || 'other content'} when focused (WCAG 2.4.11: add scroll-padding for sticky chrome)`)
  }
  expect(stops, 'the page has no keyboard stops').toBeGreaterThan(0)
  // A walk that hit its cap has not seen the rest of the page: say so instead of passing it.
  if (!finished) problems.push(`the tab order has more than ${maxStops} stops, so the rest of the page was not checked (raise maxStops for this state)`)
  for (let i = 0; i < Math.min(stops, maxStops); i++) {
    await page.keyboard.press('Shift+Tab')
    const stop = await probeFocus(page)
    if (!stop) break
    if (stop.obscured) problems.push(`${stop.label} is hidden behind ${stop.coveredBy || 'other content'} when reached backwards (WCAG 2.4.11: add scroll-padding for sticky chrome)`)
  }
  expect([...new Set(problems)]).toEqual([])
}

/**
 * @param {Record<string, State>} states Opens each state of the app (navigates, mocks, opens the dialog).
 * @param {{ aaa?: 'gate' | 'report' | 'off', noKeyboard?: string[], maxStops?: number }} [options] How WCAG AAA findings are treated (default `report`; a repo
 *   moves to `gate` in the release that clears them); `noKeyboard` names states with nothing to operate (a static summary, a modal that
 *   only reports progress), which skip the keyboard pass: every other state must have at least one keyboard stop; `maxStops` (default 300) caps the keyboard walk, and a page with more stops fails rather than passing unchecked.
 */
export function defineA11ySuite(states, { aaa = 'report', noKeyboard = [], maxStops } = {}) {
  for (const [name, state] of Object.entries(states)) {
    const open = typeof state === 'function' ? state : state.open
    const disableRules = typeof state === 'function' ? [] : (state.disableRules ?? [])
    test.describe(name, () => {
      test.beforeEach(async ({ page }) => {
        await offline(page)
      })

      for (const { theme, season } of looks().filter((l) => l.viewport === 'desktop')) {
        test(`WCAG 2.2 AA and AAA (${theme} · ${season})`, async ({ page }) => {
          await page.emulateMedia({ colorScheme: /** @type {'light' | 'dark'} */ (theme), reducedMotion: 'reduce' })
          await open(page)
          await applyLook(page, theme, season)
          await expectAccessible(page, { aaa, disableRules })
        })
      }

      test('reflows at 320 CSS pixels', async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 640 })
        await open(page)
        await expectNoHorizontalScroll(page)
        await expectAccessible(page, { aaa: 'off', disableRules })
      })

      test('holds at 200% text size', async ({ page }) => {
        await open(page)
        await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
        await expectNoHorizontalScroll(page)
        await expectAccessible(page, { aaa: 'off', disableRules })
      })

      test('works in forced colours', async ({ page }) => {
        await page.emulateMedia({ forcedColors: 'active' })
        await open(page)
        // The browser chooses the colours in forced-colours mode, so axe's contrast arithmetic on the declared ones does not apply.
        await expectAccessible(page, { aaa: 'off', disableRules: [...disableRules, 'color-contrast'] })
      })

      test('holds still with reduced motion', async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' })
        await open(page)
        await expectNoRunningAnimations(page)
      })

      if (!noKeyboard.includes(name)) {
        test('can be used from the keyboard, and shows where focus is', async ({ page }) => {
          // The walk probes every stop twice (forward, then backward), and WebKit animates the scroll each one causes: a page of a
          // hundred stops takes about half a minute there, longer than the default 30 s. Scale the limit with the cap.
          test.setTimeout(Math.max(60_000, (maxStops || 300) * 400))
          await open(page)
          await expectKeyboardFocusVisible(page, maxStops ? { maxStops } : {})
        })
      }
    })
  }
}
