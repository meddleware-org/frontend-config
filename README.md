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
| `/vite` | `viteTarget()` — Vite `build.target` derived from the browserslist; `meddlewareApp({ plugins, theme?, wallet?, name?, config? })` — the whole Vite configuration of a tool app (target, theme-init, brand icons, e2e guard, wallet-adapter kept out of pre-bundling); `brandIcons({ name? })` — the company mark's favicon set from `@meddleware/ui/brand/*` (served in dev, emitted at the site root with a web manifest, `<link>` tags injected; an app keeps no icon of its own and `mw-sync --check` fails on a `public/favicon.*`); `themeInit({ default })` — a Vite plugin that loads ui's `theme-init.js` first in `<head>` (the saved or default colour mode and the season applied before first paint, no inline script, no CSP hash) and adds `color-scheme` and the browser-chrome `theme-color` from the tokens. |
| `/playwright` | `definePlaywrightConfig({ port, kind?, command?, browsers?, extra? })`. |
| `/axe` | `expectAccessible(page, options)` — WCAG 2.2 AA gate; AAA as `aaa: 'gate'`, `'report'` or `'off'`. |
| `/look` | `looks()`, `applyLook(page, theme, season)`, `offline(page)`, `VIEWPORTS`, `THEMES`, `SEASONS` — the viewport × colour mode × season matrix. |
| `/shots` | `defineShots(states)` — one screenshot per state × look, for looking at the UI. |
| `/a11y` | `defineA11ySuite(states, { aaa })` — the sweep every app runs, one call: each state in every colour mode × season at WCAG 2.2 AA and AAA, a 320 px reflow, 200% text size, forced colours, reduced motion and a keyboard pass. `expectNoHorizontalScroll`, `expectNoRunningAnimations` and `expectKeyboardFocusVisible` are exported on their own. |
| `/vitest` | `vueTestConfig({ plugins, test? })` — the whole Vitest configuration of a Vue repository (jsdom, `tests/**/*.test.ts`, one copy of Vue, the UI packages processed through Vite); `inlineMeddleware` — those packages on their own; `installDialogShim()` — jsdom's missing `<dialog>` modality. |
| `/bundle` + `check-prod-bundle` | `scanBundle(dist, { also })` and the `check-prod-bundle [dist] [--also TEXT]... [--also-regex PATTERN]...` command: fails when the e2e harness (the mock-wallet hooks, or an app's own stand-in marker) is found in a production build. Run it after the production build in CI and in the Dockerfile. |
| `/wallet` | `connectMockWallet(page)`, `exposeSigner(page, signer)`, `E2E_ADDRESS` — the Playwright side of the mock wallet. |
| `/lighthouserc` | `lighthouseConfig({ port, paths?, … })` — Lighthouse CI (accessibility must score 100). |
| `/tsconfig/vue-app.json` | The compiler options of a Vue app (`"extends": "@meddleware/frontend-config/tsconfig/vue-app.json"`); the repository keeps only its `include`. |
| `/csp` | `buildCsp(options)`, `cspForProfile(name, current?)`, `PROFILES`, `scriptHashesOf(csp)` — the Content-Security-Policy every app image serves, as six named profiles (`static`, `static-strict`, `console`, `chain`, `chain-wasm`, `docs`), so the policy is written once. |
| `mw-sync` | `mw-sync --check` / `--write` in a repository root: the files every frontend repository copies (dependabot.yml, .dockerignore, postcss/stylelint configs, the Lighthouse allowlist) equal this package's `templates/`, and the Dockerfile's `ARG CSP` equals its profile. Declared in package.json: `"meddleware": { "kind": "app", "csp": "chain-wasm", "lhci": true }`. |
| `mw-network-status` | `mw-network-status --out src/network.json` (or `--check src/network.json` in CI): which networks MeddleWare is deployed on, from the installed clients' deployment records (read as text: the clients ship TypeScript source). The file is committed and CI checks it, so "mainnet is coming" turns into "live" by the records alone. |
| `mw-audit-gate` | CI dependency gate: `npm audit` at high/critical minus the dated, reasoned entries of `.github/audit-allowlist.json` (an entry with no reason or an expired date fails). |
| `mw-third-party-licenses` | Writes `dist/THIRD_PARTY_LICENSES` from the lockfile's production packages and their installed licence texts; `--check` fails when none can be written. |
| `mw-check-csp-inline` | `mw-check-csp-inline <policy or @Dockerfile> [dist]`: every inline script in the built pages is allowed by a `sha256` source in the policy, and the policy never allows `'unsafe-inline'` scripts. |

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
