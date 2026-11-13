# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
