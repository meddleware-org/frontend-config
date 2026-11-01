// CI dependency gate: `npm audit` at high/critical, minus advisories listed in
// .github/audit-allowlist.json. Each entry needs a reason and an expiry date, so an
// accepted advisory is re-reviewed instead of being ignored forever.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const ALLOWLIST = '.github/audit-allowlist.json'
const LEVELS = new Set(['high', 'critical'])
const GHSA = /^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

let failed = false
const fail = (msg) => {
  console.log(`::error::${msg}`)
  failed = true
}

const entries = existsSync(ALLOWLIST) ? JSON.parse(readFileSync(ALLOWLIST, 'utf8')) : []
if (!Array.isArray(entries)) throw new Error(`${ALLOWLIST} must be an array`)
const today = new Date().toISOString().slice(0, 10)
const allowed = new Map()
for (const e of entries) {
  if (!GHSA.test(e?.id) || typeof e.reason !== 'string' || !e.reason || !DATE.test(e.expires)) {
    fail(`invalid allowlist entry ${JSON.stringify(e)} (needs id, reason, expires YYYY-MM-DD)`)
  } else if (e.expires < today) {
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
  raw = err.stdout
}
const report = JSON.parse(raw)
if (report.error) throw new Error(`npm audit failed: ${JSON.stringify(report.error)}`)

const found = new Map()
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
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
for (const id of allowed.keys()) {
  if (!found.has(id)) console.log(`::warning::allowlist entry ${id} no longer matches an advisory; remove it`)
}

const open = [...found.keys()].filter((id) => !allowed.has(id)).length
console.log(`${found.size} high/critical advisories, ${open} not allowlisted`)
process.exit(failed ? 1 : 0)
