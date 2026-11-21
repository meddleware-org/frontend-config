#!/usr/bin/env node
// @ts-check
// mw-network-status — write which networks Meddleware is deployed on, from the deployment records of the installed client packages, so a static
// site (landing page, docs, developer docs) says "mainnet is coming" until the records have a `mainnet` key and says "live" the moment they do.
//
//   mw-network-status --out src/network.json      write the file
//   mw-network-status --check src/network.json    fail (exit 1) when the committed file differs from the records
//   mw-network-status                             print to stdout
//
// The file is committed, so the page and its tests never depend on a hidden build step; CI runs `--check`, and bumping a client package
// (Dependabot, or a release that adds a mainnet record) fails the check until the file is regenerated with `--out`.
//
// The client packages ship TypeScript source, which Node does not load from node_modules, so the records are read as text: each package's
// generated `deployments.ts` has the shape `export const X_DEPLOYMENTS = { testnet: {…}, mainnet: {…} } as const`, and only the network keys
// are needed. The repository needs `@meddleware/access-gate-client` and `@meddleware/sealed-storage-client` installed; a missing one is an error.
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** The products and the constant that holds each one's records. */
export const PRODUCTS = /** @type {const} */ ([
  ['access gate', '@meddleware/access-gate-client', 'ACCESS_GATE_DEPLOYMENTS'],
  ['sealed storage', '@meddleware/sealed-storage-client', 'SEAL_POLICIES_DEPLOYMENTS'],
])

/**
 * The network keys of `export const <constant> = { … }` in generated source: the keys at the object's top level (two-space indent).
 * @param {string} source - the text of a generated `deployments.ts`
 * @param {string} constant - the exported constant to read, such as `ACCESS_GATE_DEPLOYMENTS`
 * @returns {string[]} the network names, for example `['testnet']`
 * @throws {Error} when the constant is missing or the file's shape is not the generated one
 */
export function networksOf(source, constant) {
  const start = source.indexOf(`export const ${constant} =`)
  if (start < 0) throw new Error(`${constant} not found`)
  const open = source.indexOf('{', start)
  const end = source.indexOf('\n} as const', open)
  if (open < 0 || end < 0) throw new Error(`${constant} has an unexpected shape`)
  return [...source.slice(open, end).matchAll(/^ {2}([a-z]+): \{/gm)].map((m) => /** @type {string} */ (m[1]))
}

/**
 * Which networks are live: `live` when every product has a record there, `partial` when some do, `coming` when none does. (The same rule as
 * `networkAvailability` in `@meddleware/web-utils`, which the dashboard uses at run time.)
 * @param {Record<string, string[]>} products - product name → the networks it has a record for
 * @returns for each network: `{ status, live, missing }`
 */
export function availability(products) {
  const names = Object.keys(products)
  /**
   * One network's status.
   * @param {string} network - `testnet` or `mainnet`
   */
  const report = (network) => {
    const live = names.filter((p) => products[p]?.includes(network))
    const missing = names.filter((p) => !products[p]?.includes(network))
    return { status: names.length > 0 && missing.length === 0 ? 'live' : live.length > 0 ? 'partial' : 'coming', live, missing }
  }
  return { testnet: report('testnet'), mainnet: report('mainnet') }
}

/**
 * Read the network keys from each product's installed client package.
 * @param {string} root - the repository to resolve the client packages from
 * @returns {Record<string, string[]>} product name → the networks it has a record for
 * @throws {Error} when a client package is not installed or its records have an unexpected shape
 */
export function readRecords(root) {
  const require = createRequire(join(root, 'noop.js'))
  /** @type {Record<string, string[]>} */
  const out = {}
  for (const [name, pkg, constant] of PRODUCTS) {
    const entry = require.resolve(pkg)
    out[name] = networksOf(readFileSync(join(dirname(entry), 'deployments.ts'), 'utf8'), constant)
  }
  return out
}

// `process.argv[1]` is the symlink in node_modules/.bin when run as a bin: compare real paths.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const value = (/** @type {string} */ flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined)
  const out = value('--out')
  const check = value('--check')
  try {
    const json = JSON.stringify(availability(readRecords(process.cwd())), null, 2) + '\n'
    if (check) {
      let have = ''
      try {
        have = readFileSync(check, 'utf8')
      } catch {
        // missing counts as different
      }
      if (have !== json) {
        console.error(`mw-network-status: ${check} is out of date with the deployment records; run \`mw-network-status --out ${check}\``)
        process.exit(1)
      }
    } else if (out) writeFileSync(out, json)
    else process.stdout.write(json)
  } catch (err) {
    console.error(`mw-network-status: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}
