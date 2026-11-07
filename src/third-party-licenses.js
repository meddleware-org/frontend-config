#!/usr/bin/env node
// Writes dist/THIRD_PARTY_LICENSES: the licence and NOTICE texts of every production dependency in
// package-lock.json. The site ships a bundle, so the packages' own files do not travel with it;
// Apache-2.0 (§4), MIT and BSD all require the notice to accompany a redistribution. The file is served
// with the site (/THIRD_PARTY_LICENSES) and read by licence audits.
//
//   mw-third-party-licenses            write the file
//   mw-third-party-licenses --check    also fail when the file would be empty
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// The project root is the directory the command runs in (an app's npm script), not this package.
const root = process.cwd()
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'))
const check = process.argv.includes('--check')
const LICENSE_FILE = /^(licen[cs]e|notice|copying|unlicense)(\.|$|-)/i

const out = []
const missing = []
const apacheMissing = []
/** @param {any} pkg */
const declared = (pkg) => (typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license ?? pkg.licenses ?? 'unknown'))
/** @param {any} pkg */
const holder = (pkg) =>
  [pkg.author && (typeof pkg.author === 'string' ? pkg.author : pkg.author.name), pkg.repository && (typeof pkg.repository === 'string' ? pkg.repository : pkg.repository.url)]
    .filter(Boolean)
    .join(' · ')
const names = Object.keys(lock.packages)
  .filter((p) => p.startsWith('node_modules/') && !lock.packages[p].dev && !lock.packages[p].optional)
  .sort()
for (const p of names) {
  const dir = join(root, p)
  if (!existsSync(dir)) continue
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const files = readdirSync(dir).filter((f) => LICENSE_FILE.test(f)).sort()
  out.push(`${'='.repeat(78)}\n${pkg.name}@${pkg.version}  (${declared(pkg)})\n${'='.repeat(78)}`)
  if (files.length === 0) {
    missing.push(`${pkg.name}@${pkg.version}`)
    if (/Apache-2\.0/.test(declared(pkg))) apacheMissing.push(`${pkg.name}@${pkg.version}`)
  }
  for (const f of files) out.push(`--- ${f} ---\n${readFileSync(join(dir, f), 'utf8').trim()}\n`)
  if (files.length === 0) {
    const apache = /Apache-2\.0/.test(declared(pkg))
    out.push(`(the package ships no licence file; declared licence: ${declared(pkg)}${holder(pkg) ? `; ${holder(pkg)}` : ''}${apache ? '; the Apache License 2.0 text follows at the end of this file' : ''})\n`)
  }
}
// Apache-2.0 §4(a) asks that a recipient gets a copy of the License. A package that declares it but ships no
// file is covered by the canonical text, taken from any installed package that carries it.
if (apacheMissing.length > 0) {
  let text = null
  for (const p of Object.keys(lock.packages).filter((k) => k.startsWith('node_modules/'))) {
    const dir = join(root, p)
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).filter((x) => LICENSE_FILE.test(x))) {
      const t = readFileSync(join(dir, f), 'utf8')
      if (/Apache License\s+Version 2\.0, January 2004/.test(t) && /END OF TERMS AND CONDITIONS/.test(t)) {
        text = t.slice(0, t.indexOf('END OF TERMS AND CONDITIONS') + 'END OF TERMS AND CONDITIONS'.length).trim()
        break
      }
    }
    if (text) break
  }
  out.push(`${'='.repeat(78)}\nApache License 2.0 — applies to: ${apacheMissing.join(', ')}\n${'='.repeat(78)}`)
  out.push(text ?? '(canonical text not found in the installed packages: see https://www.apache.org/licenses/LICENSE-2.0)')
  if (check && text === null) {
    console.error('Apache-2.0 packages without a licence file, and no canonical Apache License text installed')
    process.exit(1)
  }
}
mkdirSync(join(root, 'dist'), { recursive: true })
writeFileSync(join(root, 'dist', 'THIRD_PARTY_LICENSES'), `${out.join('\n')}\n`)
console.log(`THIRD_PARTY_LICENSES: ${names.length} production packages, ${missing.length} without a licence file`)
if (missing.length) console.log(`  no licence file: ${missing.join(', ')}`)
if (check && out.length === 0) {
  console.error('no production packages found in package-lock.json')
  process.exit(1)
}
