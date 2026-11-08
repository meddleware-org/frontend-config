# Security Audit — `frontend-config`

**Classification:** Internal security review (first-pass baseline; awaiting external review)
**Project:** repos/frontend-config (`@meddleware/frontend-config`) — shared frontend tooling: browserslist, ESLint (`vueApp`), Stylelint, html-validate, PostCSS, Vite target and `themeInit`, Playwright config, axe / accessibility sweep, screenshots, Lighthouse CI config, the mock-wallet Playwright helpers and the production-bundle scan.
**Project type:** TS tooling package (JavaScript with JSDoc types and generated `.d.ts`; a dev dependency of sixteen repos; ships nothing to end users)
**Template:** AUDIT_TEMPLATE.md (2026-11-01) + AUDIT_TEMPLATE_TS.md (2026-11-01) + AUDIT_TEMPLATE_A11Y.md (2026-11-01, tooling rows). Not triggered: `AUDIT_TEMPLATE_VUE.md` (it configures Vue projects but renders nothing and has no hosting path), `AUDIT_TEMPLATE_SUI_CLIENT.md` (its mock-wallet helper drives a *test* wallet in a browser; it builds, signs and verifies nothing on a chain), `AUDIT_TEMPLATE_IMG.md` (no image).
**Deployment status:** *(Current, 2026-11-05: `0.0.2` is released to npm with provenance (CI green, trusted publishing); consumers take it through their own 2026-11-05 releases. The text below is the earlier history, kept as written.)* npm `@meddleware/frontend-config` 0.0.1 (released 2026-10-31, tag `v0.0.1`, publish run green, provenance attestation on the registry — checked 2026-11-01). Placeholder versions `0.0.0-rename.0` and `0.0.0-stage` also exist (F6). 0.0.2 released 2026-11-05 with the fixes of this audit (F1–F3). Consumers (devDependencies, `^0.0.1`): access-gate-ui, content-hub-ui, dashboard-ui, dev-site, docs-site, landing-site, roadmap-site, sealed-storage-ui, status-ui, token-issuance-ui, treasury-ui, ui, vitepress-theme, wallet-adapter, walrus-storage-kit, walrus-storage-ui.
**Review date:** 2026-11-01
**Reviewer:** Internal review
**Severity ceiling:** Medium — it ships no code to end users and holds no keys, but it runs inside every consumer's lint, build and CI process, so a compromised release could weaken or bypass the gates (or execute in a build) in sixteen repos at once.
**Status:** first-pass baseline 2026-11-01 (0.0.2 released 2026-11-05). 9 findings (1 Positive): 3 RESOLVED in source, 3 ADJUDICATED, 1 ACCEPTED-RISK, 1 DEFERRED (maintainer-only).

---

## Executive summary

This package is the platform's accessibility, browser-support and code-quality bar written once. Its security-relevant job is double: (1) it is a **supply-chain position** — a dev dependency of sixteen repos, with a large dependency tree (the lint plugins), published through a trusted publisher; (2) it **is** the evidence for many audit claims (the AA/AAA gate, the five-browser matrix, Lighthouse, the token-only colour rule, the e2e build guard), so a gap in it is a gap in those claims.

The review found the supply-chain posture sound (provenance, SHA-pinned actions, tag-gated publish, audit gate with an empty allowlist, Dependabot) and three gaps in what the tooling *proves*, all fixed in 0.0.2:

- **F1** — the e2e build guard was a build-time check only and the production-artefact scan existed in one wallet app of five. The scan is now a shared command, `check-prod-bundle`.
- **F2** — the keyboard sweep checked that a focus indicator exists but not that the focused element is visible (WCAG 2.4.11 *focus not obscured*, which axe cannot test). Added, in both tab directions.
- **F3** — `SECURITY.md` was not in the published files.

Two honest limits are recorded rather than hidden: the lint rules are a guard rail, not a barrier (`eslint-disable` defeats them — SECURITY.md says so), and automated accessibility checks cover what axe and the linters can detect; the 44 px enhanced target size, link purpose, reading order and screen-reader behaviour are reviewed by hand against screenshots (A11Y lens §C).

## Threat model / trust boundaries

| Actor / source | What it controls | Bounded by |
| --- | --- | --- |
| npm registry / this repo's publish authority | the code that runs in sixteen repos' lint, build and CI | trusted publishing + provenance, tag-gated CI, consumers' lockfiles and exact `^0.0.x` ranges |
| Transitive dependencies (ESLint/Stylelint plugins, `@axe-core/playwright`, `html-validate-vue`, `browserslist-to-esbuild`, `autoprefixer`) | code executed at consumer build/lint time | lockfile, `npm audit` gate, Dependabot, no install scripts of ours (B.TS-2) |
| A consumer's repo | which gates it enables, which rules it overrides, which states its sweep covers | this package's defaults (`tokens: 'error'`, `aaa` option, `looks()`); each consumer's audit records its overrides |
| The page under test | what the axe/focus helpers see | helpers run in the test browser; `offline(page)` refuses every non-local request |
| `themeInit` plugin input (`scriptPath`, `colors`) | the first script every app page loads | resolved from the consumer's own `node_modules`; emitted as a same-origin file, so the CSP needs no hash |
| CI environment | fonts and browser engines the gates measure | A11Y lens §C (five browser projects; CI-font reproduction, D104) |

**Primary trust anchor:** the repository's trusted publisher (OIDC, no token).

### Supply chain & input matrix (TS lens)

| Input | Producer | Validation | Failure mode |
| --- | --- | --- | --- |
| consumer's browserslist | consumer `package.json` | extends the shared config; `tests/browserslist.test.ts` keeps this repo's inlined copy identical | drift fails this repo's tests |
| `VITE_E2E` / mode | consumer build environment | `assertE2eOnlyInE2eMode` throws; `check-prod-bundle` scans the output | build / CI fails |
| `dist/` files | consumer build | read as text, regex markers, no execution | exit 1 on a hit, a missing directory or an empty one |
| `scriptPath`, `colors` | consumer `vite.config` | none needed: build-time, consumer-controlled | n/a |
| Playwright `page` | test | evaluated in the test browser only | assertion failure |

## Severity scale

Critical / High / Medium / Low / Info / Positive — unchanged across the corpus.

## Scope

In scope: `src/*.js` (15 modules and the `.cjs` browserslist), `tests/*.ts` (9 files), `package.json` (`exports`, `bin`, `files`, `dependencies`, `peerDependencies`), `.github/` (workflows, audit gate and allowlist, Dependabot), `SECURITY.md`, `CLAUDE.md`, `README.md`, the published tarball, the registry record.

Out of scope: how each consumer configures and overrides the helpers (each consumer's audit), the design tokens, the third-party tools themselves.

Environment and commands (2026-11-01, Node 26, npm 12): `npm ci`; `npm ls --all`; `node .github/audit-gate.mjs` (0 high/critical); `npm run type-check`; `npx vitest run` (9 files, 89 tests with a real Chromium; 79 before the fixes); `npm run build`; `npm pack --dry-run --json`; `npm view @meddleware/frontend-config versions dist.attestations.provenance`.

## Findings

### F1 — The e2e harness had no shared production-artefact scan
**Severity:** Medium   **Disposition:** RESOLVED
**Where:** `src/vite.js::assertE2eOnlyInE2eMode` (guard only); consumers' CI and Dockerfiles.
**Issue:** the wallet apps load a mock wallet and a stub chain in an e2e build, and sealed-storage-ui additionally swaps its Seal controller for a stand-in that does no encryption. The controls were (a) the entry loads the harness only when `MODE === 'e2e'` and `VITE_E2E === '1'` (static replacement), (b) `assertE2eOnlyInE2eMode` throws when `VITE_E2E` is set in another mode. Neither inspects the **built output**; only token-issuance-ui had a scan (`scripts/check-prod-bundle.mjs`, run in CI and in its Dockerfile). Base §B.2 *Test-only modes* and VUE §A *Test hooks* require the absence to be asserted on the production artefact.
**Impact:** a future change to an entry file, a bundler upgrade that stops folding the static condition, or a mis-set mode in an image build would ship a mock wallet in a signing app, and nothing but a reviewer would notice. The stand-in controller would ship a "encryption" that returns plaintext under a fixed id.
**Remediation / evidence:** `scanBundle` / `check-prod-bundle [dist] [--also TEXT]... [--also-regex PATTERN]...` (`src/bundle.js`, `src/check-prod-bundle.js`, subpath `/bundle`, package `bin`): fails on any hook the shared harness registers (`__registerMockWallet`, `__unregisterMockWallet`, `__e2eAddress`, `__e2eWalletAddress`, `__e2eSignTransaction`, `__e2eSignPersonalMessage`, `__getSuiClient`) and on app-supplied markers (literal text, or a pattern), fails when `dist` is missing or holds no script/HTML file (a skipped build cannot pass). 10 tests: clean build, every hook in a nested chunk, literal vs pattern markers, non-script files ignored, CLI exit codes 0/1/2, an invalid pattern refused. Consumers adopt it in their next releases (each app's audit, delta section); `CLAUDE.md` requires a new hook in `wallet-adapter/testing` to be added to `E2E_MARKERS` in the same change. 0.0.2.

### F2 — The keyboard sweep did not check that focus is not obscured
**Severity:** Medium   **Disposition:** RESOLVED
**Where:** `src/a11y.js::expectKeyboardFocusVisible` (used by `defineA11ySuite`).
**Issue:** the helper verified that each Tab stop is visible and shows an outline or shadow. WCAG 2.2 SC 2.4.11 (AA) requires a focused element not to be entirely hidden by author-created content such as a sticky header; axe has no rule for it, and D104 recorded a real instance (a sticky header needing `scroll-padding-block-start`). The audit claims "focus not obscured" would have been unproven.
**Impact:** keyboard and screen-magnifier users lose track of focus; a regression in sticky chrome would pass CI.
**Remediation / evidence:** each stop is probed with `elementFromPoint` at five points (centre and four inset corners of the part inside the viewport); hidden means all five are covered by something that neither contains nor is contained by the stop. The walk runs forward, then Shift+Tab backward over the same stops (a browser scrolls a stop into view from the side it arrives from). Problems name the stop, the rule and the element that covers it (`hidden behind header.mw-header`), and the walk first moves the pointer out of the way (a pointer an earlier click left over a hover tooltip kept it open over the controls — met in Firefox on token-issuance-ui). Tests (Chromium): a stop under a fixed bar fails; a stop covered when reached backwards fails; a partly covered stop passes; a stop inside the layer on top (a dialog's own control) passes. Writing the first consumer spec that uses the suite on a widget (walrus-storage-kit) exposed a second defect in the same helper: a page reached with focus already on its last control left the document on the first Tab and counted "no keyboard stops"; the first press now only wraps; the keyboard pass now starts at the top of the document with the pointer parked, and judges each stop only after the scroll has come to rest (WebKit animates the scroll that focus causes: probing at once saw `input#price` under the header on the iPhone project, where it settles fully visible). `defineA11ySuite` also takes `noKeyboard: [state names]` for states with nothing to operate (a static summary, a progress-only modal): they skip the keyboard pass, every other state must have a stop. The walk itself had two blind spots, both found when the vitepress-theme fixture passed although its footer link was provably under the fixed sidebar (docs-site then failed three tests on it): it ended when a *label* repeated (pages with several links of the same text ended the walk early, before the footer), and it ended silently at its stop cap. It now detects a cycle by element identity (a `WeakSet` reset at the top of each walk), the cap is 300 stops (`maxStops` in `defineA11ySuite` for a page that needs more) and a walk that reaches it **fails** ("the tab order has more than N stops"). Tests: alternating repeated labels followed by a covered link fail (verified to pass on the old walk); a page over the cap fails. Limits: the check sees a covered stop, not its *reading order*; Chrome centres an off-screen target, so a sticky header is caught mostly through static overlaps — a scroll-dependent case needs WebKit/Firefox, which the five-project CI run provides. 0.0.2.

### F3 — `SECURITY.md` not published
**Severity:** Low   **Disposition:** RESOLVED
**Where:** `package.json` `files`.
**Issue:** `SECURITY.md` exists in the repo but the published tarball omitted it (web-utils ships its own); the CI contents check also rejected it.
**Remediation / evidence:** added to `files` and the contents regex. 0.0.2.

### F4 — `assertE2eOnlyInE2eMode` reads `process.env`, not `.env` files
**Severity:** Low   **Disposition:** ADJUDICATED
**Where:** `src/vite.js`; callers in access-gate-ui, dashboard-ui, sealed-storage-ui, walrus-storage-ui (`assertE2eOnlyInE2eMode(mode)`); token-issuance-ui passes `loadEnv(mode, cwd, '')`.
**Issue:** Vite loads `.env*` files into `import.meta.env`, not into `process.env` at config time, so `VITE_E2E=1` placed in an env file is not seen by the four callers using the default.
**Impact:** none on its own: the harness entry is gated on `MODE === 'e2e'` **and** the flag, both statically replaced, so a flag in an env file cannot include the harness in another mode; and F1's scan now proves the output. The guard is defence in depth.
**Remediation / evidence:** adjudicated — keeping the helper free of a Vite import; the backstop is the static double condition plus the scan. The four apps keep `(mode)`; token-issuance-ui's `loadEnv` form stays valid.

### F5 — Large third-party footprint, executed in every consumer's CI
**Severity:** Medium   **Disposition:** ACCEPTED-RISK
**Where:** `package.json` `dependencies` (16 direct; about 900 lines of `npm ls --omit=dev --all`), `peerDependencies`.
**Issue:** installing it installs ESLint, Stylelint and html-validate plugins, `@axe-core/playwright`, `autoprefixer` and their trees; each runs at lint/build time with the developer's or CI's privileges.
**Impact:** a compromised transitive release would run in sixteen repos' CI. No consumer ships it to end users (all `devDependencies`; verified from the manifests) and CI jobs hold no publish credentials except the publish job, which installs with `npm ci` from the lockfile.
**Remediation / evidence:** compensating controls, all verified: lockfile committed and `npm ci` everywhere; audit gate in CI and in the publish workflow with an empty allowlist (0 high/critical at review); Dependabot (npm + Actions, grouped, weekly); provenance on this package; consumers pin `^0.0.x` and the lockfile fixes the tree; install-time scripts: none of ours. The footprint is the price of one shared bar instead of sixteen drifting ones (D102). Review again if a runtime dependency is added.

### F6 — Placeholder npm versions
**Severity:** Info   **Disposition:** DEFERRED
**Where:** npm — `0.0.0-rename.0`, `0.0.0-stage`.
**Remediation / evidence:** deprecate them (credentialed npm action): `OPERATOR_TASKS.md`, npm housekeeping item 3, with the exact command and the list of all eighteen packages. Cosmetic; not a mainnet gate.

### F7 — `defineA11ySuite` and `defineShots` are exercised by consumers, not by this repo's tests
**Severity:** Info   **Disposition:** ADJUDICATED
**Where:** `src/a11y.js::defineA11ySuite`, `src/shots.js`.
**Issue:** the assertions the suite is built from have two-direction tests against a real Chromium; the registration functions themselves (which iterate states × looks and call `test()`) are not run by this repo's test runner, since they register Playwright tests.
**Impact:** a break would appear as a red or empty suite in the consumers at once; twelve consumers run the suite on every push.
**Remediation / evidence:** adjudicated — an empty suite is detectable (Playwright reports "no tests found"; each consumer's state list is non-empty). Suggestion S2.

### F8 — The lint rules and compat ignores are a guard rail
**Severity:** Info   **Disposition:** ADJUDICATED
**Where:** `src/stylelint.js`, `src/eslint.js`, `src/html-validate.js`.
**Issue:** an `eslint-disable`, `stylelint-disable` or an `ignores` entry defeats them; three browser features are ignored on purpose (`css-resize`, `css3-cursors`, `extended-system-fonts`, each degrading harmlessly with the reason in the source); `a11y/media-prefers-reduced-motion` and `a11y/selector-pseudo-class-focus` are off because `@meddleware/ui`'s reset provides the behaviour globally; `tel-non-breaking` is off for a crash in html-validate 11 on dynamic `:href` (nothing links to `tel:`).
**Impact:** none beyond what SECURITY.md states. Each consumer's audit lists its own disables under *Known exceptions* (A11Y lens).
**Remediation / evidence:** each off-switch has its reason beside it and in `CLAUDE.md`; revisit `tel-non-breaking` when html-validate fixes the crash.

### F9 — Positive: gates proven in both directions; resolution independent of the consumer's layout
**Severity:** Positive
**Evidence:** axe helper tests drive a real Chromium (a known violation is reported, a compliant page is not); stylelint/eslint/html-validate tests run the configs against violating and allowed fixtures; plugins and the standard config are resolved from this package (`import.meta.resolve`), so a pnpm or hoisted layout cannot change which rules apply; the browserslist test fails if the inlined copy drifts from the shared one; `offline(page)` makes every sweep hermetic (every non-local request is refused); `looks()` is one matrix for both screenshots and axe sweeps, so a look added there is covered by both.

---

## Section A — Invariant verification matrix

| # | Invariant | Enforced at | Proven by | Status |
| --- | --- | --- | --- | --- |
| I1 | One browser support promise drives prefixing, both compat lints and the Vite target | `browserslist-config.cjs`, `postcss.js`, `stylelint.js`, `eslint.js`, `vite.js` | `browserslist.test.ts`, `tooling.test.ts` | HOLDS |
| I2 | WCAG 2.2 A/AA is always a hard gate; AAA is `report` / `gate` / `off` by option | `axe.js`, `index.js` tags | `axe.test.ts` (5, real Chromium) | HOLDS |
| I3 | The sweep covers reflow at 320 px, 200% text, forced colours, reduced motion, keyboard and focus-not-obscured | `a11y.js` | `a11y.test.ts` (15) | HOLDS (F2) |
| I4 | Every look (theme × season; viewports) is shared by screenshots and sweeps | `look.js` | `tooling.test.ts` | HOLDS |
| I5 | A production `dist/` containing the e2e harness fails the check | `bundle.js`, `check-prod-bundle.js` | `bundle.test.ts` (10) | HOLDS (F1) |
| I6 | `VITE_E2E` in a non-e2e mode fails a build | `vite.js::assertE2eOnlyInE2eMode` | `tooling.test.ts` | HOLDS (F4) |
| I7 | Colours and `z-index` come from tokens; no hex colour | `stylelint.js` (`color-no-hex`, `declaration-strict-value`) | `stylelint.test.ts` (13) | HOLDS |
| I8 | Template ARIA and label rules see through `@meddleware/ui` form components | `eslint.js`, `html-validate.js` | `eslint.test.ts` (11), `html-validate.test.ts` (8) | HOLDS |
| I9 | Tooling resolves its own plugins, whatever the consumer's `node_modules` layout | `stylelint.js`, `html-validate.js` | `stylelint.test.ts`, `html-validate.test.ts` | HOLDS |
| I10 | Lighthouse accessibility must score 100; weight is a warning | `lighthouserc.js` | `tooling.test.ts` | HOLDS |
| I11 | The sweep makes no network request beyond localhost | `look.js::offline` | consumers' specs call it in `beforeEach` | HOLDS (code-only) |

## Section B — Supply-chain, publish-authority & capability matrix

### B.1 Dependency & CVE risk

| Dependency | Pinned | Liveness dependency? | CVE / audit status | Notes |
| --- | --- | --- | --- | --- |
| `@axe-core/playwright` ~4.14, axe-core | lockfile | test time only | clean at review | exact minor range |
| `eslint-plugin-vue`, `eslint-plugin-vuejs-accessibility`, `eslint-plugin-compat`, `@vue/eslint-config-typescript`, `typescript-eslint`, `vue-eslint-parser` | lockfile | lint time only | clean | |
| `stylelint-config-standard`, `@double-great/stylelint-a11y`, `stylelint-declaration-strict-value`, `stylelint-no-unsupported-browser-features`, `postcss-html` | lockfile | lint time only | clean | |
| `html-validate-vue`, `autoprefixer`, `browserslist-to-esbuild` | lockfile | build/lint time only | clean | |
| `@meddleware/eslint-config` ^0.0.4 | lockfile | lint time only | audited separately | exact on 0.0.x |
| peers: `@playwright/test` ~1.64.1, `eslint` ^10, `html-validate` ^11, `postcss` ^8.5, `stylelint` ^17 | consumer | | clean | optional where a subpath needs them |
| caniuse-lite data (via browserslist) | lockfile | `browserslist` list ages | n/a | refreshed by Dependabot bumps |

`node .github/audit-gate.mjs`: 0 high/critical advisories, allowlist empty (2026-11-01). The `@lhci/cli` advisories live in the twelve consumers, not here (D104; their audits).

### B.2 Publish authority & CI

| Authority | Held by | Custody | Gates | Rotation |
| --- | --- | --- | --- | --- |
| npm publish | GitHub OIDC trusted publisher for `meddleware-org/frontend-config`, `npm-publish.yml` | no token | tag `v*`, `verify` job = `node-ci.yml` on the tagged commit | revoke the trusted publisher on suspicion |

#### CI & release integrity

- **Actions pinned** — HOLDS (full SHAs; the actionlint image is digest-pinned).
- **Least privilege** — HOLDS (`contents: read`; `id-token: write` only on `publish-npm`).
- **OIDC / provenance** — HOLDS (`--provenance`; npm 11.20.0 pinned for the publish job).
- **Tag-gated, idempotent publish** — HOLDS (tag must equal the version; a registry 200 skips).
- **Release gate equals CI** — HOLDS (`workflow_call`).
- **Automated dependency updates** — HOLDS (`dependabot.yml`: npm and Actions, grouped).
- **Secrets never echoed / Real funds** — N/A (none).
- **Test-only modes** — HOLDS: this package *provides* the scan (F1); it contains no test mode itself (its `wallet.js` drives the page-side mock but ships no page code).

### B.TS-1 Packaging

`files`: `src`, `dist`, `CHANGELOG.md`, `SECURITY.md` (F3). 33 files, 24 KiB before the additions: sources, declarations, no tests. CI asserts required files and rejects strays. `exports` list fourteen subpaths plus `bin`; types resolve to `dist/*.d.ts`.

### B.TS-2 Install-time code

No lifecycle script except `prepublishOnly: npm run build`. The `bin` file is plain ESM. No `overrides`.

### B.TS-3 Supply-chain gates

Lockfile, `npm ci`, audit gate in CI and publish, exact `^0.0.x` range for consumers. First-party shared-tooling rule (TS lens): exact pin and lockfile — HOLDS in the sixteen consumers; provenance — HOLDS; minimal inventoried runtime dependencies — see F5 (accepted: they are the product); no publish credentials in consumers' verify jobs — HOLDS (publish jobs only); consumer bump together — a convention (CLAUDE.md), enforced by review; forced allowlist entries share one expiry (2027-01-31, D104) — HOLDS in the twelve consumers.

## Section C — Test-coverage & hermetic/live split

### C.1 Coverage grade — A− (89 tests, 9 files, vitest with a real Chromium, 2026-11-01)

| Dimension | Assessment |
| --- | --- |
| Happy path | covered for every subpath |
| Error / failure paths | covered: violations reported by axe, lint rules and the sweep; bundle scan exit codes; guard throws |
| Boundary | `looks()` matrix, CI vs local browser sets, empty `dist`, literal vs pattern markers |
| Security-relevant | the e2e scan and guard (F1, F4); lint boundary re-export |

Gap: `defineA11ySuite` / `defineShots` registration (F7).

### C.2 Hermetic vs. live paths

All hermetic: pages are `setContent` fixtures; Chromium is the only real browser the tests need. Firefox/WebKit behaviour of the sweep is exercised by the consumers' five-project CI runs, not here (the helpers' own tests run Chromium only).

## Section D — Deployment-readiness gates

### pre-localnet
- [x] builds; type-check and tests green; no secrets
- [x] deps install clean

### pre-testnet
- [x] published with provenance; consumers live on testnet
- [x] CI gates green incl. Node 24 floor and a real Chromium
- [x] `SECURITY.md` present; published as of 0.0.2 (F3)
- [ ] 0.0.2 released and adopted by the wallet apps' CI (F1) — in this wave
- [ ] placeholder versions deprecated (F6) — maintainer

### pre-mainnet
- [ ] external review (ADR-0009 gate G4: not a launch gate; covered by redeploy and the audit pass)
- [ ] renumber to 0.2.0 at go-live

## Cross-project themes

- **Supply chain & release integrity** — B.2 and F5.
- **Wire-format coupling** — three coupled contracts: the mock-wallet hooks between `@meddleware/wallet-adapter/testing` and `E2E_MARKERS` / `wallet.js` (a new hook must be added to the markers in the same change — CLAUDE.md); the `tokens.json` / `theme-init.js` files `themeInit` reads from the app's own `node_modules` (`@meddleware/design-tokens`, `@meddleware/ui`; a missing file fails the build); the helper names the `suiBoundary` rule accepts (`@meddleware/eslint-config`).
- **On-chain-truth boundary** — N/A (no chain logic). `sui: true` only appends the chain-access lint boundary.
- **Deployment readiness** — Section D.
- **Chain-access layering** — N/A.
- **Versioning policy** — patch-only until mainnet; F1–F3 ship as 0.0.2.

## Normative requirements (MUST / MUST NOT)

- **FC-M1** MUST gate on WCAG 2.2 AA with no option to lower it; AAA only moves from `report` to `gate` (I2).
- **FC-M2** MUST keep the browserslist in one place and derive prefixing, both compat lints and the Vite target from it (I1).
- **FC-M3** MUST scan a production `dist/` for the e2e harness and fail on a hit or an empty `dist` (I5).
- **FC-M4** MUST add any new test-wallet hook to `E2E_MARKERS` with the change that introduces it.
- **FC-M5** MUST publish only through the tag-gated trusted-publisher workflow and keep runtime dependencies inventoried (F5).
- **FC-M6** MUST keep every disabled rule's reason beside it (F8).

## Implementation suggestions (SHOULD / MAY)

- **S1** SHOULD lint this package's own JavaScript (it type-checks with `checkJs` but runs no ESLint).
- **S2** MAY register a tiny Playwright self-test for `defineA11ySuite` (F7).
- **S3** MAY add a Lighthouse budget check for `maxScriptKb` against a built fixture.

## Open questions (`OQ#`)

- **OQ1** — Should `assertE2eOnlyInE2eMode` be made to read `.env` files (a `vite` peer and `loadEnv`) so that the four callers get the stricter check token-issuance-ui already has? Currently adjudicated (F4); the scan is the backstop.

## Risks

- One compromised release reaches sixteen repos' CI at once (F5).
- Automated accessibility checks are partial by nature; a green sweep is not a conformance claim (A11Y lens §C, recorded in each app's audit).
- Playwright and browser engine updates change what the sweep sees; the Playwright peer is pinned to a minor (`~1.64.1`) so an update is a deliberate bump.

## Re-verification log

- 2026-11-01 — first-pass baseline. Read every module and test; ran `npm ci`, `npm ls --all`, the audit gate (0), type-check, the tests (79 → 87, real Chromium), build and `npm pack --dry-run`; checked the registry (versions, provenance); listed every consumer and its dependency kind from the manifests (all devDependencies); recorded the AAA state (`aaa: 'gate'` in all twelve app/site sweeps). Fixed F1–F3 (0.0.2, unreleased at the time of writing). F6 handed to `OPERATOR_TASKS.md`.
