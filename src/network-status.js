#!/usr/bin/env node
// @ts-check
// mw-network-status — write which networks MeddleWare is deployed on, from the deployment records of the installed client packages, so a static
// site (landing page, docs, developer docs) says "mainnet is coming" until the records have a `mainnet` key and says "live" the moment they do.
//
//   mw-network-status [--out src/network.json]     (default: print to stdout)
//
// Run it from the repository root before the build (a `prebuild` script). The repository needs `@meddleware/web-utils` and the two clients
// (`@meddleware/access-gate-client`, `@meddleware/sealed-storage-client`) installed; it fails when one is missing rather than guess.
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** @param {string} name */
async function load(name) {
  const require = createRequire(join(process.cwd(), 'noop.js'))
  return import(pathToFileURL(require.resolve(name)).href)
}

/**
 * @param {{ networkAvailability: Function }} utils
 * @param {Record<string, Record<string, unknown>>} records product name → its deployments object
 */
export function networkStatus(utils, records) {
  return utils.networkAvailability(Object.fromEntries(Object.entries(records).map(([name, deployments]) => [name, Object.keys(deployments)])))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2)
  const outIndex = args.indexOf('--out')
  const out = outIndex >= 0 ? args[outIndex + 1] : undefined
  try {
    const utils = await load('@meddleware/web-utils')
    const gate = await load('@meddleware/access-gate-client')
    const sealed = await load('@meddleware/sealed-storage-client')
    const status = networkStatus(utils, { 'access gate': gate.ACCESS_GATE_DEPLOYMENTS, 'sealed storage': sealed.SEAL_POLICIES_DEPLOYMENTS })
    const json = JSON.stringify(status, null, 2) + '\n'
    if (out) writeFileSync(out, json)
    else process.stdout.write(json)
  } catch (err) {
    console.error(`mw-network-status: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}
