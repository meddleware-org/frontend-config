/**
 * Tests for `mw-network-status` (`src/network-status.js`): reading the network keys from generated deployment records, deciding live,
 * partial or coming, and the command's write, check and symlinked-bin modes. The client packages are fakes built in temp directories, so
 * a real release of a client (with a mainnet key) cannot change what these tests expect.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { availability, networksOf } from '../src/network-status.js'

/** Temp directories to remove after each test. */
const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

/**
 * The text of a generated `deployments.ts` with the given networks.
 * @param constant - the exported constant's name
 * @param networks - the network keys it holds
 */
const records = (constant: string, networks: string[]) =>
  `// Generated\nexport interface X { a: string }\nexport const ${constant} = {\n${networks.map((n) => `  ${n}: {\n    originalId: '0x1',\n  },\n`).join('')}} as const satisfies Record<string, X>\nexport type N = keyof typeof ${constant}\n`

/**
 * Install a fake client package whose `deployments.ts` holds the given networks.
 * @param root - the repository to install it in
 * @param name - the package name
 * @param constant - the deployment constant's name
 * @param networks - the network keys
 */
function fakePackage(root: string, name: string, constant: string, networks: string[]) {
  const dir = join(root, 'node_modules', ...name.split('/'))
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', type: 'module', exports: './src/index.ts' }))
  writeFileSync(join(dir, 'src/index.ts'), 'export {}')
  writeFileSync(join(dir, 'src/deployments.ts'), records(constant, networks))
}

/**
 * A repository with both client packages installed.
 * @param mainnet - whether the records include a `mainnet` key
 * @returns the repository's directory
 */
function repo(mainnet: boolean) {
  const d = mkdtempSync(join(tmpdir(), 'ns-'))
  dirs.push(d)
  const nets = mainnet ? ['testnet', 'mainnet'] : ['testnet']
  fakePackage(d, '@meddleware/access-gate-client', 'ACCESS_GATE_DEPLOYMENTS', nets)
  fakePackage(d, '@meddleware/sealed-storage-client', 'SEAL_POLICIES_DEPLOYMENTS', nets)
  return d
}

/** The command's source file. */
const cli = join(import.meta.dirname, '..', 'src', 'network-status.js')
/** Run the command in a directory. */
const run = (cwd: string, ...args: string[]) => spawnSync('node', [cli, ...args], { cwd, encoding: 'utf8' })

describe('networksOf', () => {
  it('reads only the top-level network keys of the records', () => {
    expect(networksOf(records('A_DEPLOYMENTS', ['testnet', 'mainnet']), 'A_DEPLOYMENTS')).toEqual(['testnet', 'mainnet'])
  })
  it('fails on a missing constant or a changed shape', () => {
    expect(() => networksOf('export const B = {}', 'A_DEPLOYMENTS')).toThrow(/not found/)
    expect(() => networksOf('export const A_DEPLOYMENTS = { x: 1 }', 'A_DEPLOYMENTS')).toThrow(/unexpected shape/)
  })
})

describe('availability', () => {
  it('is coming while no record has a mainnet key, partial while some do, live when all do', () => {
    expect(availability({ a: ['testnet'], b: ['testnet'] }).mainnet.status).toBe('coming')
    expect(availability({ a: ['testnet', 'mainnet'], b: ['testnet'] }).mainnet).toEqual({ status: 'partial', live: ['a'], missing: ['b'] })
    expect(availability({ a: ['mainnet'], b: ['mainnet'] }).mainnet.status).toBe('live')
    expect(availability({}).mainnet.status).toBe('coming')
  })
})

describe('mw-network-status', () => {
  it('writes the file from the installed clients', () => {
    const d = repo(false)
    expect(run(d, '--out', 'network.json').status).toBe(0)
    const json = JSON.parse(readFileSync(join(d, 'network.json'), 'utf8'))
    expect(json.testnet.status).toBe('live')
    expect(json.mainnet).toEqual({ status: 'coming', live: [], missing: ['access gate', 'sealed storage'] })
  })
  it('sees a mainnet key as soon as the records have one', () => {
    expect(JSON.parse(run(repo(true)).stdout).mainnet.status).toBe('live')
  })
  it('--check passes on a current file and fails on a stale or missing one', () => {
    const d = repo(false)
    expect(run(d, '--check', 'network.json').status).toBe(1)
    run(d, '--out', 'network.json')
    expect(run(d, '--check', 'network.json').status).toBe(0)
    writeFileSync(join(d, 'node_modules/@meddleware/access-gate-client/src/deployments.ts'), records('ACCESS_GATE_DEPLOYMENTS', ['testnet', 'mainnet']))
    expect(run(d, '--check', 'network.json').status).toBe(1)
  })
  it('runs through a symlink, as an installed bin does', () => {
    const d = repo(false)
    mkdirSync(join(d, 'node_modules/.bin'), { recursive: true })
    const link = join(d, 'node_modules/.bin/mw-network-status')
    symlinkSync(cli, link)
    expect(spawnSync(link, ['--out', 'network.json'], { cwd: d, encoding: 'utf8' }).status).toBe(0)
    expect(readFileSync(join(d, 'network.json'), 'utf8')).toContain('access gate')
  })
  it('fails when a client is not installed', () => {
    const d = mkdtempSync(join(tmpdir(), 'ns-'))
    dirs.push(d)
    const r = run(d)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('mw-network-status')
  })
})
