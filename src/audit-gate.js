#!/usr/bin/env node
// @ts-check
/**
 * mw-audit-gate: the CI dependency gate. It runs `npm audit` and fails on any high or critical advisory, except those listed in
 * .github/audit-allowlist.json. Each allow-list entry needs a reason and an expiry date, so an accepted advisory is re-reviewed instead of
 * being ignored forever.
 *
 * Run by every app's Node CI workflow as `npx --no-install mw-audit-gate` after `npm ci`, and by this package's own CI as
 * `node src/audit-gate.js`. Exit 1 on an open advisory or an invalid or expired allow-list entry; 0 otherwise.
 *
 * This file is the source of the gate. The shared packages that cannot depend on this one (design-tokens and web-utils are leaves) keep a
 * copy of the same text in `.github/audit-gate.mjs`, without the shebang and the type annotations (FU-0196 tracks keeping them identical).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

/** Where accepted advisories are listed: `[{ id: "GHSA-…", reason: "…", expires: "YYYY-MM-DD" }]`. */
const ALLOWLIST = '.github/audit-allowlist.json'
/** The severities that fail the build (moderate and low do not, by fleet policy). */
const LEVELS = new Set(['high', 'critical'])
/** A GitHub advisory id: `GHSA-` and three groups of four characters from GitHub's alphabet (no vowels or look-alikes). */
const GHSA = /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/
/** An ISO date, compared as a string against today. */
const DATE = /^\d{4}-\d{2}-\d{2}$/

/** Set when any check fails; every problem is printed before exiting. */
let failed = false
/**
 * Report a failure as a GitHub Actions error annotation and remember it.
 * @param {string} msg - what is wrong
 */
const fail = (msg) => {
  console.log(`::error::${msg}`)
  failed = true
}

// A missing allow-list means nothing is accepted.
const entries = existsSync(ALLOWLIST) ? JSON.parse(readFileSync(ALLOWLIST, 'utf8')) : []
if (!Array.isArray(entries)) throw new Error(`${ALLOWLIST} must be an array`)
const today = new Date().toISOString().slice(0, 10)
/** Valid, unexpired entries by advisory id. */
const allowed = new Map()
for (const e of entries) {
  if (!GHSA.test(e?.id) || typeof e.reason !== 'string' || !e.reason || !DATE.test(e.expires)) {
    fail(`invalid allowlist entry ${JSON.stringify(e)} (needs id, reason, expires YYYY-MM-DD)`)
  } else if (e.expires < today) {
    // An expired acceptance fails the build: someone must look at the advisory again.
    fail(`allowlist entry ${e.id} expired on ${e.expires}; re-review it`)
  } else {
    allowed.set(e.id, e)
  }
}

let raw
try {
  raw = execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 << 20 })
} catch (err) {
  // npm audit exits non-zero whenever it reports anything; the JSON is still on stdout.
  raw = /** @type {{ stdout: string }} */ (err).stdout
}
const report = JSON.parse(raw)
// An audit that could not run (no network, a registry error) fails closed rather than passing silently.
if (report.error) throw new Error(`npm audit failed: ${JSON.stringify(report.error)}`)

/** High and critical advisories found, by advisory id (the last part of the advisory URL). */
const found = new Map()
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    // `via` is either an advisory object or the name of another vulnerable package; only advisories are counted.
    if (typeof via === 'object' && LEVELS.has(via.severity)) {
      found.set(via.url.split('/').pop(), via)
    }
  }
}

for (const [id, via] of found) {
  const entry = allowed.get(id)
  if (entry) {
    console.log(`::warning::${id} (${via.name}, ${via.severity}) allowed until ${entry.expires}: ${entry.reason}`)
  } else {
    fail(`${id} (${via.name}, ${via.severity}): ${via.title}`)
  }
}
// An entry that no longer matches anything is stale; a warning keeps the list short.
for (const id of allowed.keys()) {
  if (!found.has(id)) console.log(`::warning::allowlist entry ${id} no longer matches an advisory; remove it`)
}

const open = [...found.keys()].filter((id) => !allowed.has(id)).length
console.log(`${found.size} high/critical advisories, ${open} not allowlisted`)
process.exit(failed ? 1 : 0)
