#!/usr/bin/env node
// @ts-check
// CLI for `scanBundle`: `check-prod-bundle [dist] [--also MARKER]...`. Exit 1 when the harness is found, when `dist` is missing or when it
// holds no .js/.html file (a build that has not run must not pass).
import { scanBundle } from './bundle.js'

const args = process.argv.slice(2)
/** @type {string[]} */
const also = []
/** @type {string[]} */
const rest = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--also') {
    const marker = args[++i]
    if (!marker) {
      console.error('check-prod-bundle: --also needs a marker')
      process.exit(2)
    }
    also.push(marker)
  } else rest.push(/** @type {string} */ (args[i]))
}
const dist = rest[0] ?? 'dist'

let result
try {
  result = scanBundle(dist, { also })
} catch (e) {
  console.error(`check-prod-bundle: cannot read ${dist}/ (${/** @type {Error} */ (e).message}) — build first.`)
  process.exit(1)
}
if (result.scanned === 0) {
  console.error(`check-prod-bundle: no .js/.html files under ${dist}/ — build first.`)
  process.exit(1)
}
if (result.hits.length > 0) {
  console.error(`check-prod-bundle: the e2e harness is in the production bundle:\n  ${result.hits.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-prod-bundle: ${result.scanned} files clean (no e2e hooks${also.length ? ` or the ${also.length} extra marker(s)` : ''}).`)
