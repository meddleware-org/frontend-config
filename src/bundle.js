// @ts-check
// Production-artefact scan for the end-to-end harness. An app's e2e build (`vite build --mode e2e`) registers a mock wallet, a stub chain
// and sometimes a stand-in for a module that needs a live service; none of it may reach a production build. The app's entry loads the
// harness only when the mode is `e2e` and `VITE_E2E` is `1` (both statically replaced), so every other build drops the block. This scan
// proves it on the built files instead of trusting that: it fails when a hook or marker is found in `dist/`.
//
//   // package.json: "check:bundle": "check-prod-bundle dist"
//   // CI, after the production build; and in the Dockerfile, right after `npm run build`
//   // an app with its own stand-in adds a marker: "check-prod-bundle dist --also 'e2e session key'"
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * What the shared harness (`@meddleware/wallet-adapter/testing` `installE2eWallet`, `@meddleware/frontend-config/wallet`) leaves in a
 * bundle that includes it: the hooks it puts on `window`. Property names survive minification.
 */
export const E2E_MARKERS = Object.freeze([
  { name: '__registerMockWallet hook', re: /__registerMockWallet/ },
  { name: '__unregisterMockWallet hook', re: /__unregisterMockWallet/ },
  { name: '__e2eAddress hook', re: /__e2eAddress/ },
  { name: '__e2eWalletAddress hook', re: /__e2eWalletAddress/ },
  { name: '__e2eSignTransaction hook', re: /__e2eSignTransaction/ },
  { name: '__e2eSignPersonalMessage hook', re: /__e2eSignPersonalMessage/ },
  { name: '__getSuiClient hook', re: /__getSuiClient/ },
])

/**
 * Every built `.js`, `.mjs` and `.html` file under a directory, depth first.
 * @param {string} dir - the directory to walk
 * @returns {Generator<string>} the file paths
 */
function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* files(path)
    else if (/\.(m?js|html)$/.test(name)) yield path
  }
}

/**
 * Scan the built files under `dist` for the harness.
 * @param {string} dist - the build output directory
 * @param {{ also?: (string | RegExp)[] }} [options] - `also`: extra markers, an app's own stand-in (a string is matched literally)
 * @returns {{ scanned: number, hits: string[] }} how many files were read, and `file: marker` for every hit
 * @throws {Error} when `dist` cannot be read
 */
export function scanBundle(dist, { also = [] } = {}) {
  const markers = [
    ...E2E_MARKERS,
    // A string marker is escaped so text such as `e2e.session` matches itself and not any character in the dot's place.
    ...also.map((m) => ({ name: `marker ${String(m)}`, re: typeof m === 'string' ? new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) : m })),
  ]
  let scanned = 0
  /** @type {string[]} */
  const hits = []
  for (const file of files(dist)) {
    scanned++
    const text = readFileSync(file, 'utf8')
    for (const { name, re } of markers) if (re.test(text)) hits.push(`${relative(dist, file)}: ${name}`)
  }
  return { scanned, hits }
}
