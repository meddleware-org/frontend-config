#!/usr/bin/env node
// @ts-check
// CLI for `scanBundle`: `check-prod-bundle [dist] [--also TEXT]... [--also-regex PATTERN]...` (text is matched literally). Exit 1 when the harness is found, when `dist` is missing or when it
// holds no .js/.html file (a build that has not run must not pass).
import { scanBundle } from './bundle.js'

// Exit codes: 0 clean; 1 the harness is in the bundle or there is nothing to scan; 2 the command line is wrong.
const args = process.argv.slice(2)
/**
 * Extra markers from `--also` (literal text) and `--also-regex`.
 * @type {(string | RegExp)[]}
 */
const also = []
/**
 * The positional arguments: the build directory.
 * @type {string[]}
 */
const rest = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--also' || args[i] === '--also-regex') {
    const flag = args[i]
    const marker = args[++i]
    // A flag with nothing after it is a usage error, not an empty marker (which would match every file).
    if (!marker) {
      console.error(`check-prod-bundle: ${flag} needs a marker`)
      process.exit(2)
    }
    try {
      also.push(flag === '--also' ? marker : new RegExp(marker))
    } catch {
      console.error(`check-prod-bundle: ${marker} is not a valid pattern`)
      process.exit(2)
    }
  } else rest.push(/** @type {string} */ (args[i]))
}
const dist = rest[0] ?? 'dist'

// What `scanBundle` found.
let result
try {
  result = scanBundle(dist, { also })
} catch (e) {
  console.error(`check-prod-bundle: cannot read ${dist}/ (${/** @type {Error} */ (e).message}) — build first.`)
  process.exit(1)
}
// An empty directory must fail: a build that has not run would otherwise "pass" by having nothing to find.
if (result.scanned === 0) {
  console.error(`check-prod-bundle: no .js/.html files under ${dist}/ — build first.`)
  process.exit(1)
}
if (result.hits.length > 0) {
  console.error(`check-prod-bundle: the e2e harness is in the production bundle:\n  ${result.hits.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-prod-bundle: ${result.scanned} files clean (no e2e hooks${also.length ? ` or the ${also.length} extra marker(s)` : ''}).`)
