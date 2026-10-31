// @ts-check
// The "looks" a page is checked in: viewport × colour mode × season. Shared by the screenshot matrix and the axe sweeps so a
// look added here is covered by both. Seasons come from @meddleware/design-tokens (seasons.css, `data-season` on <html>).

export const VIEWPORTS = Object.freeze({
  phone: Object.freeze({ width: 390, height: 844 }),
  tablet: Object.freeze({ width: 768, height: 1024 }),
  desktop: Object.freeze({ width: 1280, height: 900 }),
})
export const THEMES = Object.freeze(['light', 'dark'])
export const SEASONS = Object.freeze(['none', 'spring', 'summer', 'autumn', 'winter'])

/** Desktop covers every theme × season; tablet and phone cover each theme with no season. */
export function looks() {
  /** @type {{ viewport: keyof typeof VIEWPORTS, theme: string, season: string }[]} */
  const out = []
  for (const viewport of /** @type {(keyof typeof VIEWPORTS)[]} */ (Object.keys(VIEWPORTS))) {
    for (const theme of THEMES) {
      for (const season of viewport === 'desktop' ? SEASONS : ['none']) out.push({ viewport, theme, season })
    }
  }
  return out
}

/**
 * Refuse every request that leaves localhost, so a run needs no network. Failed fetches are expected and are not page errors.
 * @param {import('@playwright/test').Page} page
 */
export async function offline(page) {
  await page.route(/^https?:\/\/(?!(localhost|127\.0\.0\.1)[:/])/, (route) => route.abort())
}

/**
 * Put the page in a look. Uses the real colour-mode control when the page has one and is not behind a modal dialog (as a visitor would, so
 * the control's own state matches the page); otherwise sets the attribute (galleries; VitePress, which themes with a `.dark` class).
 * @param {import('@playwright/test').Page} page
 * @param {string} theme `light` | `dark`
 * @param {string} season `none` | a season name
 */
export async function applyLook(page, theme, season) {
  const control = page.getByRole('button', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true })
  // An open modal dialog makes the rest of the page inert (its colour-mode control cannot be clicked), so the look is set directly then.
  if ((await control.count()) && !(await page.locator('dialog[open]').count())) await control.first().click()
  else {
    await page.evaluate((t) => {
      const root = document.documentElement
      root.setAttribute('data-theme', t)
      root.classList.toggle('dark', t === 'dark')
    }, theme)
  }
  await page.evaluate((s) => {
    const root = document.documentElement
    if (s === 'none') root.removeAttribute('data-season')
    else root.setAttribute('data-season', s)
  }, season)
  // Let colour transitions and the like finish, so a check or a screenshot sees the look and not a frame on the way to it.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))).then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))))
  await page.waitForTimeout(150)
}
