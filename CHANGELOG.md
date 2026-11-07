# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.3] - 2026-11-07

### Added

- `mw-audit-gate`, `mw-third-party-licenses` and `mw-check-csp-inline`: the dependency-audit gate, the licence bundle and the inline-script
  CSP check that every app repository carried as its own copy of a script.
- `/csp`: `buildCsp`, `cspForProfile` and six named profiles that reproduce, byte for byte, the policies the app images served.
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
