// @ts-check
// @meddleware/frontend-config — shared frontend tooling. Each concern has its own subpath export (see package.json
// "exports"); this entry holds the constants the others agree on.

/** axe tags that gate a build: WCAG 2.0, 2.1 and 2.2 level A and AA, plus axe's best practices. */
export const AXE_TAGS_AA = Object.freeze(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])

/** axe tags reported but never gating: WCAG AAA (enhanced contrast and so on). */
export const AXE_TAGS_AAA = Object.freeze(['wcag2aaa'])

/** Playwright projects for the browsers the support promise names (engines: Chromium, Gecko, WebKit; two mobile viewports). */
export const BROWSER_PROJECTS = Object.freeze(['chromium', 'firefox', 'webkit', 'mobile-chrome', 'mobile-safari'])
