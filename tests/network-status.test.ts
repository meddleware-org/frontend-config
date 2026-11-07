import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { networkStatus } from '../src/network-status.js'

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function fakePackage(root: string, name: string, source: string) {
  const dir = join(root, 'node_modules', ...name.split('/'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0', type: 'module', exports: './index.js' }))
  writeFileSync(join(dir, 'index.js'), source)
}

function repo(mainnet: boolean) {
  const d = mkdtempSync(join(tmpdir(), 'ns-'))
  dirs.push(d)
  fakePackage(d, '@meddleware/web-utils', "export const networkAvailability = (p) => ({ seen: p })")
  fakePackage(d, '@meddleware/access-gate-client', `export const ACCESS_GATE_DEPLOYMENTS = { testnet: {}${mainnet ? ', mainnet: {}' : ''} }`)
  fakePackage(d, '@meddleware/sealed-storage-client', `export const SEAL_POLICIES_DEPLOYMENTS = { testnet: {}${mainnet ? ', mainnet: {}' : ''} }`)
  return d
}

const cli = join(import.meta.dirname, '..', 'src', 'network-status.js')

describe('mw-network-status', () => {
  it('hands the networks of each record to networkAvailability', () => {
    expect(networkStatus({ networkAvailability: (p: unknown) => p }, { a: { testnet: 1 }, b: { testnet: 1, mainnet: 2 } })).toEqual({ a: ['testnet'], b: ['testnet', 'mainnet'] })
  })
  it('writes the file from the installed clients', () => {
    const d = repo(false)
    const r = spawnSync('node', [cli, '--out', 'network.json'], { cwd: d, encoding: 'utf8' })
    expect(r.status).toBe(0)
    expect(JSON.parse(readFileSync(join(d, 'network.json'), 'utf8')).seen).toEqual({ 'access gate': ['testnet'], 'sealed storage': ['testnet'] })
  })
  it('sees a mainnet key as soon as the record has one', () => {
    const d = repo(true)
    const r = spawnSync('node', [cli], { cwd: d, encoding: 'utf8' })
    expect(JSON.parse(r.stdout).seen['access gate']).toContain('mainnet')
  })
  it('--check passes on a current file and fails on a stale or missing one', () => {
    const d = repo(false)
    expect(spawnSync('node', [cli, '--check', 'network.json'], { cwd: d, encoding: 'utf8' }).status).toBe(1)
    spawnSync('node', [cli, '--out', 'network.json'], { cwd: d })
    expect(spawnSync('node', [cli, '--check', 'network.json'], { cwd: d, encoding: 'utf8' }).status).toBe(0)
    writeFileSync(join(d, 'node_modules/@meddleware/access-gate-client/index.js'), 'export const ACCESS_GATE_DEPLOYMENTS = { testnet: {}, mainnet: {} }')
    expect(spawnSync('node', [cli, '--check', 'network.json'], { cwd: d, encoding: 'utf8' }).status).toBe(1)
  })
  it('runs through a symlink, as an installed bin does', () => {
    const d = repo(false)
    mkdirSync(join(d, 'node_modules/.bin'), { recursive: true })
    symlinkSync(cli, join(d, 'node_modules/.bin/mw-network-status'))
    const r = spawnSync(join(d, 'node_modules/.bin/mw-network-status'), ['--out', 'network.json'], { cwd: d, encoding: 'utf8' })
    expect(r.status).toBe(0)
    expect(readFileSync(join(d, 'network.json'), 'utf8')).toContain('access gate')
  })
  it('fails when a client is not installed', () => {
    const d = mkdtempSync(join(tmpdir(), 'ns-'))
    dirs.push(d)
    const r = spawnSync('node', [cli], { cwd: d, encoding: 'utf8' })
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('mw-network-status')
  })
})
