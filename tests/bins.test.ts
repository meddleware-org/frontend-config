import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..', 'src')
const dirs: string[] = []
function dir(files: Record<string, string> = {}): string {
  const d = mkdtempSync(join(tmpdir(), 'bin-'))
  dirs.push(d)
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(d, name, '..'), { recursive: true })
    writeFileSync(join(d, name), text)
  }
  return d
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})
const run = (script: string, cwd: string, ...args: string[]) => spawnSync('node', [join(SRC, script), ...args], { cwd, encoding: 'utf8' })

describe('mw-check-csp-inline', () => {
  const hash = 'sha256-' + 'x'.repeat(43) + '='
  it('passes pages with no inline script and with an allowed one', () => {
    const d = dir({ 'dist/index.html': '<script src="/a.js"></script>' })
    expect(run('check-csp-inline.js', d, "script-src 'self'", 'dist').status).toBe(0)
  })
  it('fails an inline script that is not allowed by hash, and refuses unsafe-inline', () => {
    const d = dir({ 'dist/index.html': '<script>alert(1)</script>' })
    expect(run('check-csp-inline.js', d, "script-src 'self'", 'dist').status).toBe(1)
    expect(run('check-csp-inline.js', d, "script-src 'self' 'unsafe-inline'", 'dist').status).toBe(1)
    void hash
  })
  it('reads the policy from a Dockerfile (@Dockerfile) and fails an empty build', () => {
    const d = dir({ Dockerfile: 'ARG CSP="script-src \'self\'"\n', 'dist/index.html': '<p>hi</p>' })
    expect(run('check-csp-inline.js', d, '@Dockerfile', 'dist').status).toBe(0)
    expect(run('check-csp-inline.js', dir({ 'dist/readme.txt': 'x' }), "script-src 'self'", 'dist').status).toBe(2)
  })
})

describe('mw-third-party-licenses', () => {
  const lock = { packages: { '': {}, 'node_modules/left': { version: '1.0.0' }, 'node_modules/dev': { version: '1.0.0', dev: true } } }
  it('writes dist/THIRD_PARTY_LICENSES from the lockfile and the installed packages, production only', () => {
    const d = dir({
      'package-lock.json': JSON.stringify(lock),
      'node_modules/left/package.json': JSON.stringify({ name: 'left', version: '1.0.0', license: 'MIT' }),
      'node_modules/left/LICENSE': 'MIT License\nCopyright left',
      'node_modules/dev/package.json': JSON.stringify({ name: 'dev', version: '1.0.0', license: 'MIT' }),
    })
    const r = run('third-party-licenses.js', d, '--check')
    expect(r.status).toBe(0)
    const text = readFileSync(join(d, 'dist', 'THIRD_PARTY_LICENSES'), 'utf8')
    expect(text).toContain('left@1.0.0')
    expect(text).toContain('Copyright left')
    expect(text).not.toContain('dev@1.0.0')
  })
  it('--check fails when there is no production package', () => {
    const d = dir({ 'package-lock.json': JSON.stringify({ packages: { '': {} } }) })
    expect(run('third-party-licenses.js', d, '--check').status).toBe(1)
  })
})

describe('mw-audit-gate', () => {
  it('rejects an allowlist entry without a reason or an expiry, and an expired one', () => {
    const d = dir({ '.github/audit-allowlist.json': JSON.stringify([{ id: 'GHSA-aaaa-bbbb-cccc' }, { id: 'GHSA-jmr9-qjv8-65gv', reason: 'x', expires: '2020-01-01' }]) })
    const r = run('audit-gate.js', d)
    expect(r.stdout).toContain('invalid allowlist entry')
    expect(r.stdout).toContain('expired on 2020-01-01')
  })
})
