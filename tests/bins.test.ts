/**
 * Tests for the command-line tools that have no module API of their own: `mw-check-csp-inline`, `mw-third-party-licenses` and
 * `mw-audit-gate`. Each is run as a child process in a temp directory built for the case, as an app's CI runs it.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

/** The directory holding the commands' source. */
const SRC = join(import.meta.dirname, '..', 'src')
/** Temp directories to remove after each test. */
const dirs: string[] = []
/**
 * A temp directory holding the given files.
 * @param files - path (relative to the directory) → text
 * @returns the directory
 */
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
/** Run one of the commands in a directory. */
const run = (script: string, cwd: string, ...args: string[]) => spawnSync('node', [join(SRC, script), ...args], { cwd, encoding: 'utf8' })

describe('mw-check-csp-inline', () => {
  it('passes a page with only an external script', () => {
    const d = dir({ 'dist/index.html': '<script src="/a.js"></script>' })
    expect(run('check-csp-inline.js', d, "script-src 'self'", 'dist').status).toBe(0)
  })
  it('passes an inline script whose hash the policy allows, and names it when the policy does not', () => {
    // The browser hashes the script's exact text, so the same text is hashed here.
    const body = 'window.x = 1'
    const hash = 'sha256-' + createHash('sha256').update(body).digest('base64')
    const d = dir({ 'dist/index.html': `<script>${body}</script>` })
    expect(run('check-csp-inline.js', d, `script-src 'self' '${hash}'`, 'dist').status).toBe(0)
    const refused = run('check-csp-inline.js', d, "script-src 'self'", 'dist')
    expect(refused.status).toBe(1)
    expect(refused.stderr).toContain(hash)
  })
  it('fails an inline script that is not allowed by hash, and refuses unsafe-inline', () => {
    const d = dir({ 'dist/index.html': '<script>alert(1)</script>' })
    expect(run('check-csp-inline.js', d, "script-src 'self'", 'dist').status).toBe(1)
    // 'unsafe-inline' would make every hash meaningless, so it fails even for a page with no inline script.
    expect(run('check-csp-inline.js', d, "script-src 'self' 'unsafe-inline'", 'dist').status).toBe(1)
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

// Only the allow-list validation is tested: the rest needs `npm audit` and the registry (the gate runs for real in every repository's CI).
describe('mw-audit-gate', () => {
  it('rejects an allowlist entry without a reason or an expiry, and an expired one', () => {
    const d = dir({ '.github/audit-allowlist.json': JSON.stringify([{ id: 'GHSA-aaaa-bbbb-cccc' }, { id: 'GHSA-jmr9-qjv8-65gv', reason: 'x', expires: '2020-01-01' }]) })
    const r = run('audit-gate.js', d)
    expect(r.stdout).toContain('invalid allowlist entry')
    expect(r.stdout).toContain('expired on 2020-01-01')
  })
})
