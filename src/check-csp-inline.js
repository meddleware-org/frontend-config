#!/usr/bin/env node
// Fails the build when dist/ contains an inline <script> that the CSP's script-src does not allow, or when script-src allows
// 'unsafe-inline'. VitePress inlines a couple of small scripts (the appearance/theme bootstrap and the page-hash map); the image serves a
// hash-based CSP, so a VitePress upgrade (or a change of the `appearance` option) that changes them must update the Dockerfile's CSP ARG
// in the same change — this check makes that impossible to miss, in CI as well as in the image build.
//
// Usage: mw-check-csp-inline "<csp>" [distDir]
//        mw-check-csp-inline @Dockerfile [distDir]   (reads the Dockerfile's `ARG CSP="…"` default)
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const [source, dist = 'dist'] = process.argv.slice(2)
if (!source) {
  console.error('usage: mw-check-csp-inline "<csp>"|@Dockerfile [distDir]')
  process.exit(2)
}

let csp = source
if (source.startsWith('@')) {
  const m = readFileSync(source.slice(1), 'utf8').match(/^ARG CSP="([^"]*)"/m)
  if (!m?.[1]) {
    console.error(`CSP check: no 'ARG CSP="…"' default found in ${source.slice(1)}`)
    process.exit(2)
  }
  csp = m[1]
}

const scriptSrc = (csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src ')) ?? '').split(/\s+/)
if (scriptSrc.includes("'unsafe-inline'")) {
  console.error("CSP check: script-src allows 'unsafe-inline'; the page must not.")
  process.exit(1)
}
const allowed = new Set(scriptSrc.filter((t) => t.startsWith("'sha256-")).map((t) => t.slice(1, -1)))

/**
 * @param {string} dir
 * @returns {Generator<string>}
 */
function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* htmlFiles(p)
    else if (name.endsWith('.html')) yield p
  }
}

const missing = new Map()
let files = 0
for (const file of htmlFiles(dist)) {
  files++
  const html = readFileSync(file, 'utf8')
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    if (!m[1].trim()) continue
    const hash = 'sha256-' + createHash('sha256').update(m[1]).digest('base64')
    if (!allowed.has(hash)) missing.set(hash, file)
  }
}
if (files === 0) {
  console.error(`CSP check: no HTML file found in ${dist}; build first.`)
  process.exit(2)
}
if (missing.size) {
  console.error(`CSP check: ${missing.size} inline script(s) not allowed by script-src:`)
  for (const [hash, file] of missing) console.error(`  '${hash}'  (first seen in ${file})`)
  process.exit(1)
}
console.log(`CSP check: every inline script in ${files} HTML file(s) is allowed by script-src.`)
