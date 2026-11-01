# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2026-11-01

### Added

- `check-prod-bundle` (and `scanBundle` at `/bundle`): the production-artefact scan for the e2e harness, moved here from token-issuance-ui so
  every wallet app runs the same one (the mock-wallet hooks; `--also` adds an app's own stand-in marker).

- `expectKeyboardFocusVisible` (and so `defineA11ySuite`) now also fails a stop that is entirely hidden behind sticky or fixed content when it
  takes focus (WCAG 2.4.11 focus not obscured; axe has no rule for it), going forward and then backwards through the tab order.

### Changed

- `SECURITY.md` is part of the published files.

## [0.0.1] - 2026-10-31

### Added

- First release. Shared browserslist config, ESLint (`vueApp`), Stylelint, html-validate, PostCSS, Vite target, Playwright config,
  axe helper (WCAG 2.2 AA gate, AAA reported), screenshot matrix and Lighthouse CI config, extracted from the per-repo copies in
  the frontend repos.
