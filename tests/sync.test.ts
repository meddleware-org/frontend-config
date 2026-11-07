import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cspForProfile } from '../src/csp.js'
import { sync } from '../src/sync.js'

const dirs: string[] = []
function repo(meddleware: object, files: Record<string, string> = {}): string {
  const d = mkdtempSync(join(tmpdir(), 'sync-'))
  dirs.push(d)
  writeFileSync(join(d, 'package.json'), JSON.stringify({ name: 'x', meddleware }))
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(d, name, '..'), { recursive: true })
    writeFileSync(join(d, name), text)
  }
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
const dockerfile = (csp: string) => `FROM scratch\nARG CSP="${csp}"\nRUN true\n`

describe('mw-sync', () => {
  it('fails an app repository that has none of the template files, and --write creates them', () => {
    const d = repo({ kind: 'app', lhci: true })
    const before = sync(d)
    expect(before.every((r) => !r.ok)).toBe(true)
    expect(before.map((r) => r.file)).toEqual(['.github/dependabot.yml', '.dockerignore', 'postcss.config.js', 'stylelint.config.js', '.github/audit-allowlist.json'])
    expect(sync(d, { write: true }).every((r) => r.ok)).toBe(true)
    expect(sync(d).every((r) => r.ok)).toBe(true)
    expect(readFileSync(join(d, 'postcss.config.js'), 'utf8')).toContain('@meddleware/frontend-config/postcss')
  })

  it('detects drift in a template file', () => {
    const d = repo({ kind: 'app' })
    sync(d, { write: true })
    writeFileSync(join(d, '.dockerignore'), 'node_modules\n')
    const r = sync(d)
    expect(r.find((x) => x.file === '.dockerignore')).toMatchObject({ ok: false })
  })

  it('checks the Dockerfile CSP against its profile and rewrites it, keeping the docs hashes', () => {
    const d = repo({ csp: 'chain-wasm' }, { Dockerfile: dockerfile(cspForProfile('chain')) })
    expect(sync(d)[0]).toMatchObject({ file: 'Dockerfile', ok: false })
    expect(sync(d, { write: true })[0]).toMatchObject({ ok: true })
    expect(readFileSync(join(d, 'Dockerfile'), 'utf8')).toContain("'wasm-unsafe-eval'")
    const docs = repo({ csp: 'docs' }, { Dockerfile: dockerfile(cspForProfile('docs').replace("script-src 'self'", "script-src 'self' 'sha256-abc='")) })
    expect(sync(docs)[0]).toMatchObject({ ok: true })
  })

  it('fails when the Dockerfile has no CSP default and when there is nothing to check', () => {
    expect(sync(repo({ csp: 'static' }, { Dockerfile: 'FROM scratch\n' }))[0]).toMatchObject({ ok: false })
    expect(sync(repo({}))[0]).toMatchObject({ ok: false, file: 'package.json' })
  })

  it('the CLI exits 1 on drift, 0 when clean, 2 without a mode', () => {
    const d = repo({ kind: 'app' })
    const cli = join(import.meta.dirname, '..', 'src', 'sync.js')
    const run = (...a: string[]) => spawnSync('node', [cli, ...a], { cwd: d, encoding: 'utf8' })
    expect(run('--check').status).toBe(1)
    expect(run('--write').status).toBe(0)
    expect(run('--check').status).toBe(0)
    expect(run().status).toBe(2)
  })
})
