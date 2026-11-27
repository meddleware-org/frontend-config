# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.17] - 2026-11-27

### Changed
- Documentation pass (line-level annotation): every source file, test, template, workflow and configuration file explains itself; a Development
  section in the README; Commands, Gotchas and Related sections in CLAUDE.md; CONTRIBUTING.md and AGENTS.md. The shared templates
  (`dependabot.app.yml`, `postcss.config.js`, `stylelint.config.js`) gained header and why-comments, so apps running `mw-sync --check` see a
  difference until they take this release and run `mw-sync --write`.
- `templates/audit-allowlist.lhci.json` is now an empty list. Its one entry, the picomatch advisory GHSA-fc5q-39xc-vjpf, has been withdrawn
  by GitHub, so every app's copy only produced a "no longer matches an advisory" warning. Apps with `"lhci": true` take the empty list from
  `mw-sync --write`.
- `.github/audit-gate.mjs` is removed from this repository: its CI runs `src/audit-gate.js` (the same code, shipped as `mw-audit-gate`) directly.
  The empty `.github/audit-allowlist.json` is removed with it (a missing file means nothing is accepted).

### Fixed
- The `mw-check-csp-inline` test now checks what its title claimed: an inline script whose `sha256` the policy allows passes, and the same
  script is named when the policy does not allow it (it only tested the refusals). A test title in `ports.test.ts` said 4000 where it asserts 4100.

## [0.0.16] - 2026-11-19

### Added

- `@meddleware/frontend-config/storage`: `defineStorageSuite(pages, { allow, settleMs })`, `expectNothingStored`, `readDeviceState`,
  `watchOtherHosts`. Each page is opened in a fresh browser and must store nothing and ask no other host for anything before the
  visitor acts (PECR Sch. A1). Apps opt in with an `e2e/storage.spec.ts`.

## [0.0.15] - 2026-11-18

- `defineA11ySuite` adds a check to every state: a sticky or fixed header sits and paints the same (position, size, background, border, shadow) at 0, 1, 4, 8, 9, 16 and 40 px of scroll. A header that only changed after a few pixels of scroll looked as if it became "stuck" then, and showed as a jolt. A page with no sticky header, or too short to scroll, has nothing to check. Exported on its own as `expectStickyHeaderHoldsStill`. Run against the public sites on 2026-11-18, only the landing page failed (fixed in `@meddleware/ui` 0.1.44).

## [0.0.14] - 2026-11-18

- The `@playwright/test` peer is back to `~1.64.1`. Playwright 1.65.x bundles a Firefox build whose pages crash when
  `getByRole` or `getByLabel` runs after an axe scan on a page with `aria-labelledby`
  ([microsoft/playwright#43967](https://github.com/microsoft/playwright/issues/43967), #44135), which the shared a11y
  sweep does on every page; the fix (Firefox r1575) is not in a 1.65 release. The synced Dependabot template ignores
  `@playwright/test` 1.65.x until the move to 1.66.

## [0.0.13] - 2026-11-18

- The stylelint config accepts Vue's `v-bind()` in `.vue` and `.html` styles, written directly or reached through a
  custom property. stylelint 18's `declaration-property-value-no-unknown` follows `var()` to that value and called it
  unknown; any other unknown value is still an error.

## [0.0.12] - 2026-11-18

- Peers: `@playwright/test ~1.65.1` and `stylelint ^18.0.0` (were `~1.64.1` and `^17`), so consumers can take Playwright
  1.65 and stylelint 18 with stylelint-config-standard 41 together (FU-0147).
- The shared stylelint config builds on `stylelint-config-standard ^41`, `stylelint-declaration-strict-value ^1.13` and
  `@double-great/stylelint-a11y ^3.8.3`, and no longer names `declaration-block-single-line-max-declarations`, which
  stylelint 18 removed (naming it is an "Unknown rule" error there).
- `typescript-eslint ^8.73.0` (and eslint 10.15 in development): both now use `minimatch` 11, which fixes
  GHSA-g3hv-75wg-m249 (a denial of service in `minimatch` 7 to 11.0.0) for every consumer.

## [0.0.11] - 2026-11-18

- The synced `.github/audit-allowlist.json` template (`lhci: true`) lists GHSA-fc5q-39xc-vjpf (picomatch ReDoS, no patched
  release, dev tooling only) until 2027-01-31. Repositories pick it up with `mw-sync --write` after updating.

## [0.0.10] - 2026-11-13

definePlaywrightConfig never reuses a server already on the preview port (PW_REUSE_SERVER=1 opts in) and ports.json is the registry of preview ports (FU-0075); documentation spelling.

## [0.0.9] - 2026-11-13

The Lighthouse audit allowlist template is empty: @lhci/cli 0.16 no longer installs extract-zip, so the two dated extract-zip entries are gone (mw-sync --write adopts it).

## [0.0.8] - 2026-11-08

### Added

- `brandIcons` (`/vite`, added by `meddlewareApp`): serves and emits the company mark's favicon set from `@meddleware/ui/brand/*` with a web manifest and the `<link>` tags. `mw-sync` fails an app that keeps its own `public/favicon.*` (`--write` removes it).

### Changed

- The `docs` CSP profile no longer allows `https:` images (the documentation sites load none).

## [0.0.7] - 2026-11-07

### Fixed

- `mw-network-status` failed on a real install: the client packages ship TypeScript source, which Node does not load from `node_modules`. It now reads each package's generated `deployments.ts` as text.

## [0.0.6] - 2026-11-07

### Fixed

- `mw-network-status` and `mw-sync` did nothing when run as an installed bin (they compared the symlink in `node_modules/.bin` with the real path); both now compare real paths, and a test runs each through a symlink.

## [0.0.5] - 2026-11-07

### Added

- `mw-network-status --check <file>`: fails when the committed network file differs from the deployment records (for CI).

## [0.0.4] - 2026-11-07

### Added

- `mw-network-status`: writes the networks the platform is deployed on from the clients' deployment records, for the landing page, docs and developer docs.

## [0.0.3] - 2026-11-07

### Added

- `mw-audit-gate`, `mw-third-party-licenses` and `mw-check-csp-inline`: the dependency-audit gate, the licence bundle and the inline-script
  CSP check that every app repository carried as its own copy of a script.
- `/csp`: `buildCsp`, `cspForProfile` and six named profiles that reproduce, byte for byte, the policies the app images served.
- `meddlewareApp` (`/vite`), `vueTestConfig` (`/vitest`) and `tsconfig/vue-app.json`: the Vite, Vitest and TypeScript configuration that eleven
  apps each repeated.
- `mw-sync --check|--write` and `templates/`: the files that cannot be shared by reference stay identical across repositories, and the
  Dockerfile's `ARG CSP` is held equal to the repository's profile.

## [0.0.2] - 2026-11-01

### Added

- `check-prod-bundle` (and `scanBundle` at `/bundle`): the production-artefact scan for the e2e harness, moved here from token-issuance-ui so
  every wallet app runs the same one (the mock-wallet hooks; `--also` / `--also-regex` add an app's own stand-in marker).

- `expectKeyboardFocusVisible` (and so `defineA11ySuite`) now also fails a stop that is entirely hidden behind sticky or fixed content when it
  takes focus (WCAG 2.4.11 focus not obscured; axe has no rule for it), going forward and then backwards through the tab order; the message names the covering element, and the pointer is parked first so a stale hover tooltip cannot cover the walk; each stop is judged after the scroll has settled (WebKit animates the scroll that focus causes).

- `defineA11ySuite` takes `noKeyboard: [state names]` for states with nothing to operate (they skip the keyboard pass; every other state must
  have a stop). `expectKeyboardFocusVisible` no longer reports "no keyboard stops" for a page reached with focus on its last control.

### Changed

- The keyboard walk follows element identity (a repeated link label no longer ends it early), stops at 300 stops and fails when it is capped (`maxStops` raises the cap); its test limit scales with the cap (WebKit needs about half a minute for a page of a hundred stops).
- `SECURITY.md` is part of the published files.

## [0.0.1] - 2026-10-31

### Added

- First release. Shared browserslist config, ESLint (`vueApp`), Stylelint, html-validate, PostCSS, Vite target, Playwright config,
  axe helper (WCAG 2.2 AA gate, AAA reported), screenshot matrix and Lighthouse CI config, extracted from the per-repo copies in
  the frontend repos.
