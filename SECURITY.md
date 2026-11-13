# Security Policy

## Scope

This policy covers `@meddleware/frontend-config`: lint, build and test configuration for Meddleware frontends. It runs only in a
consumer's development and CI processes (ESLint, Stylelint, html-validate, PostCSS, Vite, Playwright, Lighthouse); it ships nothing
to end users and makes no network requests of its own.

It does not cover a consuming application, or the tools and plugins it configures.

## What it guarantees

The rules are a **guard rail**: they catch accidents and shortcuts, not deliberate evasion (a `stylelint-disable` or
`eslint-disable` comment defeats them). Accessibility checks are automated and cover only what axe and the linters can detect;
they are not a substitute for manual testing with assistive technology.

## Supply chain

Releases are published from this repository's `npm-publish.yml` with npm trusted publishing (OIDC and provenance); tokens are not
used. A compromised release could weaken the lint, accessibility and browser-support gates in every consumer, or run code in their
build, so report anything that suggests tampering.

## Supported versions

Only the latest published npm version receives fixes.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities. Use GitHub's private vulnerability reporting for this
repository, or email dev@meddleware.co.uk.
