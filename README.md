# @meddleware/frontend-config

Shared frontend tooling for MeddleWare apps and libraries, so a repo's config files are one-liners and every repo is held to the
same accessibility and browser-support bar.

| Subpath | What it gives you |
| --- | --- |
| `/browserslist-config` | The browser support promise (below), as a browserslist shared config. |
| `/eslint` | `vueApp({ name, sui?, ignores?, controlComponents?, labelComponents?, extra? })` — Vue + TypeScript, `eslint-plugin-vuejs-accessibility`, `eslint-plugin-compat`, optionally the Sui boundary from `@meddleware/eslint-config`. |
| `/stylelint` | `stylelintConfig({ tokens?, compat?, browsers?, rules? })` — standard config, no hex, token-only colour and `z-index`, `@double-great/stylelint-a11y`, `stylelint-no-unsupported-browser-features`. |
| `/html-validate` | `htmlValidateConfig({ elements?, rules? })` — recommended + `html-validate:a11y` + Vue, with `@meddleware/ui` components described as the native element they render. |
| `/postcss` | Autoprefixer for the repo's browserslist. |
| `/vite` | `viteTarget()` — Vite `build.target` derived from the browserslist; `themeInit({ default })` — a Vite plugin that loads ui's `theme-init.js` first in `<head>` (the saved or default colour mode and the season applied before first paint, no inline script, no CSP hash) and adds `color-scheme` and the browser-chrome `theme-color` from the tokens. |
| `/playwright` | `definePlaywrightConfig({ port, kind?, command?, browsers?, extra? })`. |
| `/axe` | `expectAccessible(page, options)` — WCAG 2.2 AA gate; AAA as `aaa: 'gate'`, `'report'` or `'off'`. |
| `/look` | `looks()`, `applyLook(page, theme, season)`, `offline(page)`, `VIEWPORTS`, `THEMES`, `SEASONS` — the viewport × colour mode × season matrix. |
| `/shots` | `defineShots(states)` — one screenshot per state × look, for looking at the UI. |
| `/a11y` | `defineA11ySuite(states, { aaa })` — the sweep every app runs, one call: each state in every colour mode × season at WCAG 2.2 AA and AAA, a 320 px reflow, 200% text size, forced colours, reduced motion and a keyboard pass. `expectNoHorizontalScroll`, `expectNoRunningAnimations` and `expectKeyboardFocusVisible` are exported on their own. |
| `/vitest` | `inlineMeddleware` — the packages a test must process through Vite (they import `.css`/`.vue`), which also gives them the test's single copy of Vue; `installDialogShim()` — jsdom's missing `<dialog>` modality. |
| `/bundle` + `check-prod-bundle` | `scanBundle(dist, { also })` and the `check-prod-bundle [dist] [--also TEXT]... [--also-regex PATTERN]...` command: fails when the e2e harness (the mock-wallet hooks, or an app's own stand-in marker) is found in a production build. Run it after the production build in CI and in the Dockerfile. |
| `/wallet` | `connectMockWallet(page)`, `exposeSigner(page, signer)`, `E2E_ADDRESS` — the Playwright side of the mock wallet. |
| `/lighthouserc` | `lighthouseConfig({ port, paths?, … })` — Lighthouse CI (accessibility must score 100). |

## Use

```jsonc
// package.json
"browserslist": ["extends @meddleware/frontend-config/browserslist-config"]
```

```ts
// eslint.config.ts
import { vueApp } from '@meddleware/frontend-config/eslint'
export default vueApp({ name: 'treasury-ui', sui: true })
```

```js
// stylelint.config.js
import { stylelintConfig } from '@meddleware/frontend-config/stylelint'
export default stylelintConfig()
```

```js
// .htmlvalidate.mjs
import { htmlValidateConfig } from '@meddleware/frontend-config/html-validate'
export default htmlValidateConfig()
```

```js
// postcss.config.js
export { default } from '@meddleware/frontend-config/postcss'
```

```ts
// playwright.config.ts
import { definePlaywrightConfig } from '@meddleware/frontend-config/playwright'
export default definePlaywrightConfig({ port: 4281 })
```

```ts
// e2e/screens.spec.ts — run with `SHOTS=1 playwright test` (a screenshot run loads only the screens specs)
import { defineShots } from '@meddleware/frontend-config/shots'
defineShots({ overview: async (page) => { await page.goto('/') } })
```

```ts
// e2e/a11y.spec.ts
import { test } from '@playwright/test'
import { expectAccessible } from '@meddleware/frontend-config/axe'
import { applyLook, looks } from '@meddleware/frontend-config/look'
for (const { theme, season } of looks()) {
  test(`home is accessible · ${theme} · ${season}`, async ({ page }) => {
    await page.goto('/')
    await applyLook(page, theme, season)
    await expectAccessible(page)
  })
}
```

## The support promise

`last 2` of Chrome, Chrome for Android, Edge, Firefox, Firefox for Android, Safari, iOS Safari and Samsung Internet, plus Firefox
ESR, minus dead browsers. It is deliberately **not** `last 2 versions`, which also selects Opera Mini, KaiOS, Baidu and QQ: every
app is a Vue SPA and the wallet apps need browser extensions, so those engines cannot run them, and fallbacks for them would cost
CSS and complexity for no working user. Features newer than the oldest browser in the list still need `@supports` or progressive
enhancement; the compat linters enforce that.

## Accessibility bar

WCAG 2.2 AA is always a hard gate: `expectAccessible` fails on any `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` or axe
best-practice violation. WCAG AAA (`wcag2aaa`, including enhanced contrast) is the target: `aaa: 'gate'` fails the run on it,
`'report'` (the default, while a repo still has findings) attaches it to the test as `aaa` annotations, `'off'` skips it. A repo
switches to `gate` in the release that clears its AAA findings. `@meddleware/design-tokens` already guarantees 7:1 for every
text and label role in every theme × season, so remaining AAA findings are local colours and sizes, not the palette.

## Browsers in tests

`definePlaywrightConfig` runs Chromium locally and five projects in CI: Chromium, Firefox, WebKit, a Pixel 7 and an iPhone 14
viewport. `E2E_BROWSERS=all` runs all five locally (install them first: `npx playwright install chromium firefox webkit`).
`SHOTS=1` keeps a screenshot run on Chromium and runs only `screens.spec.ts` (which a normal run ignores): use `SHOTS=1 playwright test` with no file filter, since the tests are attributed to `shots.js`.

## Mock wallet in Playwright (`/wallet`)

```ts
import { connectMockWallet, exposeSigner, E2E_ADDRESS } from '@meddleware/frontend-config/wallet'
await exposeSigner(page, { signTransaction, signPersonalMessage }) // optional: sign in Node (call before page.goto)
await page.goto('/')
await connectMockWallet(page) // the app's wallet dialog → "Test Wallet"
```

The page side is `@meddleware/wallet-adapter/testing` (`installE2eWallet`), registered by an app's e2e build.

## Keeping the e2e harness out of production

An app's end-to-end build (`vite build --mode e2e`) registers a mock wallet and a stub chain. Three things keep that out of every
other build: the app's entry loads it only when `import.meta.env.MODE === 'e2e' && import.meta.env.VITE_E2E === '1'` (both static, so
the block is removed); `assertE2eOnlyInE2eMode(mode)` from `/vite` fails a build with `VITE_E2E` set in any other mode; and
`check-prod-bundle dist` (`/bundle`) scans the built files for the harness's hooks and fails if any is present. An app whose e2e build also
swaps a module for a stand-in adds a marker of that stand-in: `check-prod-bundle dist --also 'a string only the stand-in contains'` (`--also-regex` takes a pattern).

## Peers

`eslint` ^10 (required for `/eslint`), and optional peers per subpath: `stylelint` ^17, `html-validate` ^11, `postcss` ^8,
`@playwright/test` ~1.64. The lint plugins are dependencies of this package and are resolved from it, so a consumer needs none of
them.
