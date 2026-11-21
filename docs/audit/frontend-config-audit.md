# Security Audit — `frontend-config`

**Classification:** Internal security review (first-pass baseline; awaiting external review)
**Project:** repos/frontend-config (`@meddleware/frontend-config`) — shared frontend tooling: browserslist, ESLint (`vueApp`), Stylelint, html-validate, PostCSS, Vite target and `themeInit`, Playwright config, axe / accessibility sweep, screenshots, Lighthouse CI config, the mock-wallet Playwright helpers and the production-bundle scan.
**Project type:** TS tooling package (JavaScript with JSDoc types and generated `.d.ts`; a dev dependency of sixteen repos; ships nothing to end users)
**Template:** AUDIT_TEMPLATE.md (2026-11-01) + AUDIT_TEMPLATE_TS.md (2026-11-01) + AUDIT_TEMPLATE_A11Y.md (2026-11-01, tooling rows). Not triggered: `AUDIT_TEMPLATE_VUE.md` (it configures Vue projects but renders nothing and has no hosting path), `AUDIT_TEMPLATE_SUI_CLIENT.md` (its mock-wallet helper drives a *test* wallet in a browser; it builds, signs and verifies nothing on a chain), `AUDIT_TEMPLATE_IMG.md` (no image).
Added 2026-11-21 (Part B documentation pass): `AUDIT_TEMPLATE_DOCS.md` (2026-11-20); `AUDIT_TEMPLATE_RFC.md` (2026-11-19), partial: the Content-Security-Policy profiles, the web manifest and favicon set, browserslist and the formats the tooling reads; `AUDIT_TEMPLATE_IOP.md` (2026-11-19), partial: public API, versioning and the shared templates; `AUDIT_TEMPLATE_PRIV.md` (2026-11-20), partial: what the package stores, requests or logs on a consumer's behalf, and the storage check it provides.
**Deployment status:** *(Current, 2026-11-21: npm **`0.0.16` is `latest`** (SLSA v1 provenance; tag `v0.0.16` → `7ccd7d3`); two documentation commits since the tag, no code change. Nineteen consumers, all dev dependencies: `^0.0.16` in access-gate-ui, content-hub-ui, dashboard-ui, dev-site, docs-site, landing-site, link-in-bio-ui, roadmap-site, sealed-storage-ui, status-ui, token-issuance-ui, treasury-ui, walrus-storage-ui; `^0.0.14` in chain-payments-kit, dao-ui, ui, vitepress-theme, wallet-adapter, walrus-storage-kit. Dependabot group #9 (eight updates) is open with CI green. The two paragraphs below are history.)* *(Earlier, 2026-11-05: `0.0.2` is released to npm with provenance (CI green, trusted publishing); consumers take it through their own 2026-11-05 releases. The text below is the earlier history, kept as written.)* npm `@meddleware/frontend-config` 0.0.1 (released 2026-10-31, tag `v0.0.1`, publish run green, provenance attestation on the registry — checked 2026-11-01). Placeholder versions `0.0.0-rename.0` and `0.0.0-stage` also exist (F6). 0.0.2 released 2026-11-05 with the fixes of this audit (F1–F3). Consumers (devDependencies, `^0.0.1`): access-gate-ui, content-hub-ui, dashboard-ui, dev-site, docs-site, landing-site, roadmap-site, sealed-storage-ui, status-ui, token-issuance-ui, treasury-ui, ui, vitepress-theme, wallet-adapter, walrus-storage-kit, walrus-storage-ui.
**Review date:** 2026-11-01; Part B documentation pass 2026-11-21 (DOCS, RFC, IOP and PRIV lenses first applied)
**Reviewer:** Internal review
**Severity ceiling:** Medium — it ships no code to end users and holds no keys, but it runs inside every consumer's lint, build and CI process, so a compromised release could weaken or bypass the gates (or execute in a build) in sixteen repos at once.
**Status:** first-pass baseline 2026-11-01 (0.0.2 released 2026-11-05); documentation pass 2026-11-21 (0.0.16 current). 12 findings (1 Positive): 6 RESOLVED in source (F18 to F20 found 2026-11-21, unreleased), 3 ADJUDICATED, 1 ACCEPTED-RISK, 1 DEFERRED (maintainer-only).

**Front matter (DOCS, RFC, IOP and PRIV lenses, added 2026-11-21):**

| Field | Value |
| --- | --- |
| Documentation status | ledger (workspace `docs/audit/DOCS_LEDGER.tsv`): 65 tracked files, 62 done (55 measured against the thresholds; the other seven are strict JSON, the `dockerignore` file and similar, documented in the README and CLAUDE.md), 3 excluded (the lockfile, `LICENSE`, the generated `docs/INTEROP.md`), 0 pending, 0 fu (2026-11-21 pass) |
| Required documents | README, CHANGELOG, SECURITY, CONTRIBUTING (added 2026-11-21), LICENSE (0BSD), CLAUDE.md, AGENTS.md (added 2026-11-21): all present |
| Doc lints | `check-docs.mjs` (workspace) is the gate. The shared `eslint-plugin-jsdoc` fragment the standard plans for consumers is added to `src/eslint.js` in Phase 5 and then switched on in consumers |
| Standards spoken | Content-Security-Policy (W3C CSP3) — implements the policy strings — `src/csp.js`; browserslist query syntax — implements the shared list — `src/browserslist-config.cjs`; Web App Manifest (W3C) — implements — `brandIcons`; WCAG 2.2 (W3C) via axe-core rules and the keyboard checks — implements the checks — `src/axe.js`, `src/a11y.js`; PECR Sch. A1 storage rule via the storage check — `src/storage.js`; ESLint flat configuration, Stylelint and html-validate configuration formats — implements — `src/eslint.js`, `src/stylelint.js`, `src/html-validate.js`; ECMAScript modules (ECMA-262), SPDX `0BSD`, Sigstore / SLSA — as the other packages |
| Deviations | none |
| Drafts relied on | none |
| Data a person can take away | none: the package holds no data about anyone |

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

Environment and commands (2026-11-21, Node 24.13 locally, Node 26 in CI, the Chromium the tests install): `npm ci`; `npm run type-check`; `npm test` (17 files, 138 tests); `npm run build`; `npm pack --dry-run --json` (58 files, nothing stray); `node src/audit-gate.js` (0 high/critical, no allow-list); actionlint 1.7.7 (the CI image, through podman). Earlier (2026-11-01, Node 26, npm 12): `npm ci`; `npm ls --all`; `node .github/audit-gate.mjs` (0 high/critical); `npm run type-check`; `npx vitest run` (9 files, 89 tests with a real Chromium; 79 before the fixes); `npm run build`; `npm pack --dry-run --json`; `npm view @meddleware/frontend-config versions dist.attestations.provenance`.

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

### Part B documentation pass (2026-11-21)

Scope: every tracked file read against the workspace's `docs/operations/DOCUMENTATION_STANDARD.md` and annotated (Part B Phase 1, the third repository); the DOCS, RFC,
IOP and PRIV lenses applied for the first time. Before and after editing: `npm ci`, the audit gate, type-check, the 17 test files (138 tests, one added), build, the package-contents check and actionlint passed. The diff is
comment-only apart from F18 to F20: the JavaScript and TypeScript compile to identical output with comments removed (except `tests/bins.test.ts` and one test title in `tests/ports.test.ts`, F19),
the YAML and JSONC parse to identical values (except the audit-gate command in `node-ci.yml`, F18), and `.gitignore` has the same patterns.

### F18 — A withdrawn advisory is still allow-listed here and in the template every app copies
**Severity:** Low   **Disposition:** RESOLVED here (2026-11-21, unreleased); the fourteen apps take it at the Phase 5 release (FU-0198)
**Where:** `.github/audit-allowlist.json` (this repository), `templates/audit-allowlist.lhci.json` (copied into every app with `"lhci": true` by `mw-sync`), and `.github/audit-gate.mjs`.
**Issue:** (1) the allow-list's only entry, GHSA-fc5q-39xc-vjpf (picomatch ReDoS), has been **withdrawn** on GitHub (checked 2026-11-21), so it matches nothing: the gate printed "no longer matches an advisory; remove it" in this repository and does so in the fourteen other repositories that carry the template (chain-payments-kit, access-gate-ui, dashboard-ui, landing-site, content-hub-ui, status-ui, docs-site, dev-site, link-in-bio-ui, sealed-storage-ui, roadmap-site, token-issuance-ui, treasury-ui, walrus-storage-ui); (2) `.github/audit-gate.mjs` was a second, un-annotated copy of `src/audit-gate.js` run by this repository's CI, one of the nine identical copies of FU-0196; (3) the executive summary says the audit gate has an empty allow-list, which was no longer true.
**Impact:** none on security (a warning, not a failure). The stale entry was an accepted-risk record for an advisory that no longer exists, and an expired date would eventually have failed every app's CI over it.
**Remediation / evidence:** the template is an empty list, this repository's allow-list file and its copy of the gate are removed, and its CI runs `node src/audit-gate.js` (the same code, shipped as `mw-audit-gate`); the gate prints no warning. The apps pick up the empty list with `mw-sync --write` when they take the release (CHANGELOG).

### F19 — Two tests claimed more than they proved
**Severity:** Low   **Disposition:** RESOLVED (2026-11-21, unreleased)
**Where:** `tests/bins.test.ts` (`mw-check-csp-inline`), `tests/ports.test.ts`.
**Issue:** the first test was titled "passes pages with no inline script and with an allowed one" but only tested a page with an external script; a `hash` constant and a `void hash` statement were left over from the case that was never written. A `ports.test.ts` title said the range is 4000 to 4999 while it asserts 4100.
**Impact:** the allowed-by-hash path of `mw-check-csp-inline`, the one every VitePress site's image depends on, had no test.
**Remediation / evidence:** a test computes the `sha256` of a real inline script, passes it in the policy (exit 0) and shows the hash is named when the policy lacks it (exit 1); the dead variable is gone; the title says 4100. 138 tests pass.

### F20 — Documentation and audit drift found by the documentation pass
**Severity:** Low   **Disposition:** RESOLVED (2026-11-21, unreleased)
**Where:** this audit, `README.md`, `CLAUDE.md`, the workflows.
**Issue:** this audit gave 0.0.2 as current, sixteen consumers and stylelint ^17 as a peer (it is ^18); said "fourteen subpaths" (nineteen `exports`) and 33 packaged files (58); the README had no Development section; CLAUDE.md had no Commands or Related section and did not say that a change to `templates/` reaches every app; the publish workflow said "Node 24 ships an older npm" in a job that runs Node 26.
**Impact:** none on the code. A maintainer or a reviewer would have been misled about what is deployed and who consumes it.
**Remediation / evidence:** the facts above are checked against npm and the consumers' manifests; the README has a Development section, CLAUDE.md Commands, Gotchas and Related sections; the workflow comment says why npm is pinned. FU-0196 is applied here (the second copy of the gate is gone).

---

## Section A — Invariant verification matrix

| # | Invariant | Enforced at | Proven by | Status |
| --- | --- | --- | --- | --- |
| I1 | One browser support promise drives prefixing, both compat lints and the Vite target | `browserslist-config.cjs`, `postcss.js`, `stylelint.js`, `eslint.js`, `vite.js` | `browserslist.test.ts`, `tooling.test.ts` | HOLDS |
| I2 | WCAG 2.2 A/AA is always a hard gate; AAA is `report` / `gate` / `off` by option | `axe.js`, `index.js` tags | `axe.test.ts` (5, real Chromium) | HOLDS |
| I3 | The sweep covers reflow at 320 px, 200% text, forced colours, reduced motion, keyboard and focus-not-obscured | `a11y.js` | `a11y.test.ts` (18) | HOLDS (F2) |
| I4 | Every look (theme × season; viewports) is shared by screenshots and sweeps | `look.js` | `tooling.test.ts` | HOLDS |
| I5 | A production `dist/` containing the e2e harness fails the check | `bundle.js`, `check-prod-bundle.js` | `bundle.test.ts` (10) | HOLDS (F1) |
| I6 | `VITE_E2E` in a non-e2e mode fails a build | `vite.js::assertE2eOnlyInE2eMode` | `tooling.test.ts` | HOLDS (F4) |
| I7 | Colours and `z-index` come from tokens; no hex colour | `stylelint.js` (`color-no-hex`, `declaration-strict-value`) | `stylelint.test.ts` (14) | HOLDS |
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
| peers: `@playwright/test` ~1.64.1, `eslint` ^10, `html-validate` ^11, `postcss` ^8.5, `stylelint` ^18 (2026-11-21; ^17 when first written) | consumer | | clean | optional where a subpath needs them |
| caniuse-lite data (via browserslist) | lockfile | `browserslist` list ages | n/a | refreshed by Dependabot bumps |

`node src/audit-gate.js`: 0 high/critical advisories, no allow-list (2026-11-21; on 2026-11-01 the gate was `.github/audit-gate.mjs` and the allow-list was empty, and the withdrawn advisory of F18 was added to it later). The `@lhci/cli` advisories live in the twelve consumers, not here (D104; their audits).

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

`files`: `src`, `dist`, `CHANGELOG.md`, `SECURITY.md` (F3). 58 files on 2026-11-21 (33 files, 24 KiB on 2026-11-01): sources, declarations, templates, the tsconfig preset, no tests. CI asserts required files and rejects strays. `exports` list nineteen subpaths (fourteen on 2026-11-01) plus six `bin` entries; types resolve to `dist/*.d.ts`.

### B.TS-2 Install-time code

No lifecycle script except `prepublishOnly: npm run build`. The `bin` file is plain ESM. No `overrides`.

### B.TS-3 Supply-chain gates

Lockfile, `npm ci`, audit gate in CI and publish, exact `^0.0.x` range for consumers. First-party shared-tooling rule (TS lens): exact pin and lockfile — HOLDS in the sixteen consumers; provenance — HOLDS; minimal inventoried runtime dependencies — see F5 (accepted: they are the product); no publish credentials in consumers' verify jobs — HOLDS (publish jobs only); consumer bump together — a convention (CLAUDE.md), enforced by review; forced allowlist entries share one expiry (2027-01-31, D104) — HOLDS in the twelve consumers.

### B.DOCS-1 Ledger state

65 tracked files: 62 done (55 of them measured against the thresholds), 3 excluded (lockfile, licence text, generated `docs/INTEROP.md`), 0 pending, 0 `fu:` rows (2026-11-21, commit recorded in the ledger).

### B.DOCS-2 Commands run

Every command in the README's Development section, CLAUDE.md's Commands section and CONTRIBUTING.md was run on 2026-11-21 and gave what the documents say: `npm ci`,
`npx playwright install chromium`, `npm run type-check`, `npm test` (138 tests), `npm run build`, `node src/audit-gate.js` (0 advisories), `npm pack --dry-run` (58 files).

### B.DOCS-3 Generated documentation

`docs/INTEROP.md` is generated by the workspace's `scripts/interop/gen-interop.py` from `config/interop.yaml` and checked there. `dist/*.d.ts` is generated from the JSDoc in `src/*.js`
(`npm run build`) and is not tracked. `docs/` holds only this audit and the generated page.

### B.RFC-1 Standards inventory

| Interface | Standard (and version) | Role | Where | Conformance evidence | Deviation |
| --- | --- | --- | --- | --- | --- |
| Security policy | Content Security Policy Level 3 (W3C): directive and source-expression grammar | implements the strings the images serve | `src/csp.js` | `tests/csp.test.ts` reproduces the six policies the images served before profiles existed; `mw-check-csp-inline` hashes inline scripts as the browser does (SHA-256, base64) | — |
| Support list | browserslist query syntax | implements the shared list | `src/browserslist-config.cjs` | `tests/browserslist.test.ts` resolves it and checks the engines it names and the ones it must not | — |
| Icons and manifest | Web Application Manifest (W3C) | implements the manifest `brandIcons` emits | `src/vite.js` | `tests/brand-icons.test.ts` | the manifest is `display: browser` on purpose (web tools are not installable apps) |
| Accessibility checks | WCAG 2.2 success criteria through axe-core tags (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, AAA) and the sweep's own checks for 1.4.10, 1.4.4, 2.3.3, 2.4.7 and 2.4.11 | implements the checks | `src/axe.js`, `src/a11y.js` | `tests/axe.test.ts`, `tests/a11y.test.ts` against a real Chromium | — |
| Storage rule | PECR reg. 6 and Sch. A1 (UK) as the platform reads it | implements the check | `src/storage.js` | `tests/storage.test.ts`; the workspace's `docs/legal/STORAGE_LEDGER.md` | the legal reading is the legal register's, not this package's |
| Tool configurations | ESLint flat config, Stylelint config, html-validate config | implements | `src/eslint.js`, `src/stylelint.js`, `src/html-validate.js` | each rule tested refused and allowed | — |
| Status file | JSON (RFC 8259) | implements | `src/network-status.js` | `tests/network-status.test.ts` | — |
| Module | ECMAScript modules (ECMA-262); CommonJS for the one browserslist file | implements | `src/*.js`, `src/browserslist-config.cjs` | the tests import every subpath as consumers do | — |
| Provenance | Sigstore / SLSA (npm provenance) | consumes | `npm-publish.yml` | `dist.attestations` on npm, SLSA v1 (checked 2026-11-21) | — |

### B.IOP-1 Export and exit drill

Not applicable: the package holds no data about anyone. A consumer leaves by copying the config files it takes from here (every one is a one-line import or a plain template, 0BSD) and dropping the dependency.

### B.IOP-2 Exit register entries

npm (publication) and GitHub Actions (CI). The Playwright browsers are downloaded by the consumer's CI from Microsoft's CDN (not by this package). No run-time dependency.

### B.IOP-3 API stability

The public API is the nineteen subpaths and six commands in the README. Versioning is patch-only until mainnet (workspace policy), so a consumer's `^0.0.x` is an exact pin and nothing changes under it; every change that moves a template
(`mw-sync` makes the apps' files differ until they take it) or a default severity is announced in `CHANGELOG.md` under the release that carries it. A rename or removal is a breaking change and is called out the same way.

### B.PRIV-1 / B.PRIV-2 / B.PRIV-3 Privacy inventories

Personal data: none. Client-side: the package stores nothing and requests nothing itself. `themeInit` and `brandIcons` add same-origin files and meta tags to a consumer's pages; the colour-mode script they load is `@meddleware/ui`'s
(its storage is that package's ledger row), and nothing is requested from another host. `storage.js` is the check that proves a consumer stores nothing before an action. Logs: none (a build and test tool). Recorded 2026-11-21.

---

## Section C — Test-coverage & hermetic/live split

### C.1 Coverage grade — A− (138 tests, 17 files, vitest with a real Chromium, 2026-11-21; 89 tests in 9 files on 2026-11-01)

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
- **FC-M7** MUST announce in the changelog any change to a file in `templates/`, because `mw-sync` makes it differ in every app until they take it (F18, B.IOP-3).

**Lens baselines (DOCS, RFC, IOP, PRIV), first recorded 2026-11-21:**

| ID | Holds? | Evidence |
| --- | --- | --- |
| DOCS-M1 | yes (all seven documents; 0BSD; CHANGELOG per release with an Unreleased section) | B.DOCS-1 |
| DOCS-M2 | yes (every file's header and every declaration documented; ledger rows done) | `check-docs.mjs --report frontend-config` |
| DOCS-M3 | yes (the options of every export are in the README and the JSDoc; the environment variables it reads, `CI`, `SHOTS`, `SHOTS_OUT`, `E2E_BROWSERS`, `PW_REUSE_SERVER`, `VITE_E2E`, are in the file headers and the README) | README, `src/*.js` |
| DOCS-M4 | yes (commands run, links resolve, ids exist) | B.DOCS-2 |
| DOCS-M5 | yes (no TODO, FIXME, XXX or HACK) | `check-docs.mjs` |
| DOCS-M6 | yes (CLAUDE.md verified against the code and the consumers, F20; AGENTS.md points to it) | this pass |
| DOCS-M7 | yes (no secrets or private data; the comments run in Node and the test browser, nothing reaches a visitor except the plugins' same-origin output, which carries no comments) | inspection |
| RFC-M1 to RFC-M7 | yes where they apply (B.RFC-1); M5 is the hosts', not a package's | B.RFC-1 |
| IOP-M3, IOP-M5 | yes (B.IOP-3; no data, no ads, no tracking); IOP-M1, M2, M4, M6, M7: not applicable (no data, no service) | B.IOP-1 to 3 |
| PRIV-M1 to PRIV-M8 | not applicable to the package itself (nothing stored, requested or logged); the storage check it provides is how consumers meet PRIV-M2 | B.PRIV |

## Implementation suggestions (SHOULD / MAY)

- **S1** SHOULD lint this package's own JavaScript (it type-checks with `checkJs` but runs no ESLint). The documentation standard's `eslint-plugin-jsdoc` fragment is the natural first rule set (Phase 5).
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
- 2026-11-21 — Part B documentation pass and first application of the DOCS, RFC, IOP and PRIV lenses (above, "Part B documentation pass"). Baseline before editing: `npm ci`, the audit gate, type-check, 137 tests in 17 files, build,
  package contents, actionlint. Every tracked file annotated to the documentation standard (headers, TSDoc on every declaration, comments on why); `CONTRIBUTING.md` and `AGENTS.md` added; README Development section; CLAUDE.md
  Commands, Gotchas and Related sections. Found and fixed **F18** (a withdrawn advisory still allow-listed, here and in the template every app copies; a duplicate copy of the gate), **F19** (a test that claimed the allowed-hash path
  and did not test it; a wrong title) and **F20** (documentation and audit drift). Verified live: npm `0.0.16` latest with SLSA v1 provenance; nineteen consumers (thirteen on `^0.0.16`, six on `^0.0.14`); the picomatch advisory
  withdrawn on GitHub; Dependabot group #9 open, CI green. Re-run after editing: the same commands, 138 tests, all passing; the diff proven comment-only apart from F18 to F20 (compiled output, parsed YAML and JSONC, `.gitignore`
  patterns). Recorded outside the repository: FU-0196 applied here (the second copy of the gate is gone), FU-0198 (the apps take the templates at Phase 5). Counts: 11 dispositioned findings + 1 Positive (F9): 6 RESOLVED (F1 to F3, F18
  to F20), 3 ADJUDICATED (F4, F7, F8), 1 ACCEPTED-RISK (F5), 1 DEFERRED (F6).
- [x] 2026-11-21: Template line cites DOCS, RFC, IOP and PRIV with their registry dates; their front-matter fields, Section B subsections and MUST rows added; F18 to F20 recorded in the findings and the log; the deployment status,
  consumers, packaging counts and test counts current.
