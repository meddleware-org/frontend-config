#!/usr/bin/env node
// @ts-check
// mw-sync — keep the files that every MeddleWare frontend repository copies from this package identical to the package's templates, and the
// Dockerfile's Content-Security-Policy equal to its named profile. Run in a repository root:
//
//   mw-sync --check    fail (exit 1) when a file differs; print which and how to fix
//   mw-sync --write    overwrite the files with the templates / the profile's policy
//
// The repository declares what it is in package.json:
//   "meddleware": { "kind": "app", "csp": "chain-wasm", "lhci": true }
//   kind  "app"  → .github/dependabot.yml, .dockerignore, postcss.config.js, stylelint.config.js are the templates
//   csp   a profile of ./csp.js → the Dockerfile's `ARG CSP="…"` is that profile's policy (`docs` keeps the script hashes already there)
//   lhci  true   → .github/audit-allowlist.json is the template (the dated allowlist for the Lighthouse CI tool chain; one expiry, reviewed together)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cspForProfile } from './csp.js'

const templates = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates')
const tpl = (/** @type {string} */ name) => readFileSync(join(templates, name), 'utf8')

/**
 * @param {string} root repository root
 * @param {{ write?: boolean }} [options]
 * @returns {{ file: string, ok: boolean, note: string }[]}
 */
export function sync(root, options = {}) {
  const pkgPath = join(root, 'package.json')
  const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : {}
  const cfg = pkg.meddleware ?? {}
  /** @type {{ file: string, ok: boolean, note: string }[]} */
  const out = []
  /** @param {string} file @param {string} want */
  const expectFile = (file, want) => {
    const p = join(root, file)
    const have = existsSync(p) ? readFileSync(p, 'utf8') : null
    if (have === want) return out.push({ file, ok: true, note: 'matches the template' })
    if (options.write) {
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, want)
      return out.push({ file, ok: true, note: have === null ? 'created' : 'rewritten' })
    }
    out.push({ file, ok: false, note: have === null ? 'missing (mw-sync --write creates it)' : 'differs from the template (mw-sync --write restores it)' })
  }
  if (cfg.kind === 'app') {
    expectFile('.github/dependabot.yml', tpl('dependabot.app.yml'))
    expectFile('.dockerignore', tpl('dockerignore'))
    expectFile('postcss.config.js', tpl('postcss.config.js'))
    expectFile('stylelint.config.js', tpl('stylelint.config.js'))
  }
  if (cfg.lhci === true) expectFile('.github/audit-allowlist.json', tpl('audit-allowlist.lhci.json'))
  if (cfg.csp) {
    const df = join(root, 'Dockerfile')
    const text = existsSync(df) ? readFileSync(df, 'utf8') : ''
    const m = text.match(/^ARG CSP="([^"]*)"/m)
    if (!m) out.push({ file: 'Dockerfile', ok: false, note: `no 'ARG CSP="…"' default found (profile ${cfg.csp})` })
    else {
      const want = cspForProfile(cfg.csp, m[1])
      if (m[1] === want) out.push({ file: 'Dockerfile', ok: true, note: `CSP equals the "${cfg.csp}" profile` })
      else if (options.write) {
        writeFileSync(df, text.replace(/^ARG CSP="[^"]*"/m, () => `ARG CSP="${want}"`))
        out.push({ file: 'Dockerfile', ok: true, note: `CSP rewritten to the "${cfg.csp}" profile` })
      } else out.push({ file: 'Dockerfile', ok: false, note: `CSP differs from the "${cfg.csp}" profile:\n    have ${m[1]}\n    want ${want}` })
    }
  }
  if (out.length === 0) out.push({ file: 'package.json', ok: false, note: 'no "meddleware" section: nothing to check (add kind / csp / lhci)' })
  return out
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2)
  const write = args.includes('--write')
  if (!write && !args.includes('--check')) {
    console.error('usage: mw-sync --check | --write')
    process.exit(2)
  }
  const results = sync(process.cwd(), { write })
  for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.file}: ${r.note}`)
  process.exit(results.every((r) => r.ok) ? 0 : 1)
}
