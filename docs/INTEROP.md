# Open standards and interoperability: frontend-config

Shared tooling: lint, tests, e2e checks, Playwright config, the sync of shared config files.

This page lists what the project speaks today, what is planned, what was considered and does not apply, where someone else can extend it, and what proves each claim. The platform-wide list is [Standards we use](https://meddleware.dev/platform/standards). A row appears there in the same change that turns a standard on.

## Spoken today

- The shared checks every app runs: sticky header, focus not obscured, nothing stored before an action
- mw-network-status, mw-sync, mw-audit-gate and the other bins (documented in its README)

## Planned

- Generators for security.txt, robots.txt, llms.txt, a sitemap, Open Graph and feed-autodiscovery tags and JSON-LD from one source

## Considered, not applicable

- none

## Extension points

- A repository opts in by running the bins; the templates are plain files

## What proves it

- its own tests
- every app's e2e sweep

_Maintained centrally with the platform's interoperability map; changes go through it so every repository says the same thing._
