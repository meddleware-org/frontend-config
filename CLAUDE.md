# CLAUDE.md — @meddleware/frontend-config

Shared frontend tooling, one subpath export per concern (see README). Source is `src/*.js` (ESM with JSDoc types; `.d.ts` built by
`tsc` into `dist/`), plus `src/browserslist-config.cjs` (browserslist loads it with `require`).

## Invariants

- **One support promise.** The browser list lives only in `src/browserslist-config.cjs`. autoprefixer, eslint-plugin-compat,
  stylelint-no-unsupported-browser-features and the Vite target all read the consumer's browserslist, which extends it. This repo's
  own `package.json` inlines the same list (browserslist cannot extend a relative path); `tests/browserslist.test.ts` fails if the
  two drift. Do not widen it to `last 2 versions` (Opera Mini, KaiOS, Baidu, QQ cannot run a wallet SPA) without a decision.
- **Resolve from this package, not the consumer.** Stylelint plugins and the standard config are resolved to absolute paths
  (`import.meta.resolve`), and the html-validate Vue plugin and postcss-html are passed as objects, so nothing depends on how the
  consumer's `node_modules` is laid out (pnpm, hoisting).
- **WCAG 2.2 AA always gates; AAA is the target.** `expectAccessible` fails on `AXE_TAGS_AA`. `AXE_TAGS_AAA` findings are `report`
  (annotations, the default) or `gate` (fail); a repo moves to `gate` in the release that clears its findings, never before (CI would
  sit red) and never later (it would regress). The tokens guarantee 7:1 for text and labels, so AAA findings are local.
- **Seasons are part of every look.** `looks()` is the matrix both the screenshots and the axe sweeps iterate (desktop: every theme
  × season; tablet and phone: each theme). Add a look there, not in a repo.
- **Token-only values.** `color-no-hex` and `declaration-strict-value` (colour properties and `z-index`) enforce the design tokens.
  A repo with literals still to fix may start `tokens: 'warning'` and must move to `error` in the release that fixes them.
- **Reduced motion is the ui reset's job.** `a11y/media-prefers-reduced-motion` is off because `@meddleware/ui`'s reset applies a global
  rule; do not turn it on per repo.
- **No hover/focus twin rule.** `a11y/selector-pseudo-class-focus` is off: the ui reset gives every focusable element a `:focus-visible` ring and `a11y/no-outline-none` stops anything removing it, so hover-only cosmetics need no `:focus` twin (calibration found 24 of them, all cosmetic).
- **Three browser features are ignored on purpose** (`css-resize`, `css3-cursors`, `extended-system-fonts`): they degrade
  harmlessly. Add to the list only with the same reasoning.
- **`eslint-config` keeps its own invariant.** `@meddleware/eslint-config` declares no plugins; the Vue/TypeScript/a11y/compat plugins
  live here. `vueApp` only re-exports its `suiBoundary()` behind `sui: true`.
- **The e2e harness never ships.** `check-prod-bundle` (`src/bundle.js`) fails when a production `dist/` contains the mock-wallet hooks; a new
  hook added to `@meddleware/wallet-adapter/testing` must be added to `E2E_MARKERS` in the same change.
- **Every export is proven by a test** in both directions (the violation is reported, the allowed form is not). The axe helper
  test drives a real Chromium.

## Release

Bump `version`, push, tag `v<version>`; `npm-publish.yml` publishes with npm trusted publishing after `node-ci.yml` (audit, type-check,
tests with Chromium, build, package contents) and the `node24-compat` floor job pass. Consumers pin `^0.0.x`, an exact pin on 0.0.x,
so bump them together.

## Commands

```bash
npm ci && npx playwright install chromium   # once; the helper tests need a browser
npm run type-check && npm test              # what CI checks, short of the build and the tarball check
npm run build && npm pack --dry-run         # dist/*.d.ts and the tarball's file list
node src/audit-gate.js                      # the dependency gate
```

## Gotchas

- **The templates reach every app.** `templates/*` are what `mw-sync --check` compares each app's files with. A change (even a comment) makes
  every app's check fail until it takes the release and runs `mw-sync --write`. While annotating an app before the release, install this
  checkout (`npm install --no-save ../frontend-config`) so its `mw-sync --check` sees the new templates.
- **Playwright is pinned to 1.64.x** (README, "Peers"): the template's Dependabot ignore of 1.65.x and the peer range move together.
- **`.github/audit-gate.mjs` is not here any more.** The gate is `src/audit-gate.js` (the `mw-audit-gate` bin) and this repository's CI
  runs it directly; the nine identical copies in the other shared packages are FU-0196.

## Documentation rules (workspace documentation standard, D144)

Every file has a header and every declaration a TSDoc comment (private declarations included); comments say why. `node scripts/check-docs.mjs --report frontend-config` (in the workspace repository) is the gate. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Related

- The audit: [`docs/audit/frontend-config-audit.md`](docs/audit/frontend-config-audit.md).
- How to propose a change: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Interoperability

- [docs/INTEROP.md](docs/INTEROP.md): the standards this project speaks, what is planned, where to extend it, and what proves each claim.
