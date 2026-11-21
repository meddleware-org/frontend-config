/**
 * Tests for the production-bundle scan (`scanBundle`, `src/bundle.js`) and its command (`check-prod-bundle`): every window hook of the
 * shared e2e harness is found, nothing else is, and a build that has not run cannot pass.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { E2E_MARKERS, scanBundle } from '../src/bundle.js'

/** The command's source file, run directly with Node. */
const CLI = join(import.meta.dirname, '..', 'src', 'check-prod-bundle.js')
/** Temp directories to remove after each test. */
const dirs: string[] = []
/**
 * Build a fake build output.
 * @param files - path (relative to the output) → text
 * @returns the output's directory
 */
function dist(files: Record<string, string>): string {
  const d = mkdtempSync(join(tmpdir(), 'bundle-'))
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
/** Run the command with these arguments. */
const run = (...args: string[]) => spawnSync('node', [CLI, ...args], { encoding: 'utf8' })

describe('scanBundle', () => {
  it('passes a build without the harness', () => {
    const d = dist({ 'index.html': '<!doctype html>', 'assets/app.js': 'console.log("hi")' })
    expect(scanBundle(d)).toEqual({ scanned: 2, hits: [] })
  })

  it('finds every window hook the shared harness registers, in nested files', () => {
    for (const hook of E2E_MARKERS.map((m) => m.re.source)) {
      const d = dist({ 'index.html': '', 'assets/deep/chunk.js': `window.${hook}=1` })
      expect(scanBundle(d).hits, hook).toEqual([expect.stringContaining('chunk.js')])
    }
  })

  it('finds an app-specific marker, given as text (literal) or as a pattern', () => {
    const d = dist({ 'a.js': 'x="e2e session key"' })
    expect(scanBundle(d, { also: ['e2e session key'] }).hits).toHaveLength(1)
    expect(scanBundle(d, { also: [/e2e\s{2,}session/] }).hits).toHaveLength(0)
    expect(scanBundle(d, { also: [/e2e session/] }).hits).toHaveLength(1)
    expect(scanBundle(dist({ 'a.js': 'x=1' }), { also: ['e2e session key'] }).hits).toEqual([])
  })

  it('treats a text marker literally, not as a pattern', () => {
    const d = dist({ 'a.js': 'abc' })
    expect(scanBundle(d, { also: ['a.c'] }).hits).toEqual([])
  })

  // A sourcemap can legitimately quote source that mentions a hook; only what ships to the browser as script or markup counts.
  it('ignores non-script files (a sourcemap or image is not scanned)', () => {
    expect(scanBundle(dist({ 'a.js': '', 'a.js.map': '__registerMockWallet', 'x.png': '__e2eAddress' })).hits).toEqual([])
  })
})

describe('check-prod-bundle CLI', () => {
  it('exits 0 on a clean build and 1 when a hook is present', () => {
    expect(run(dist({ 'a.js': 'ok' })).status).toBe(0)
    const dirty = run(dist({ 'a.js': 'w.__registerMockWallet=1' }))
    expect(dirty.status).toBe(1)
    expect(dirty.stderr).toContain('__registerMockWallet hook')
  })

  it('fails when nothing was built, so a skipped build cannot pass', () => {
    expect(run(join(tmpdir(), 'no-such-dist-dir')).status).toBe(1)
    expect(run(dist({ 'readme.txt': 'x' })).status).toBe(1)
  })

  it('takes extra markers with --also, and refuses --also without one', () => {
    const d = dist({ 'a.js': 'seal stand-in' })
    expect(run(d).status).toBe(0)
    expect(run(d, '--also', 'seal stand-in').status).toBe(1)
    expect(run(d, '--also').status).toBe(2)
  })

  it('takes a pattern with --also-regex, and refuses an invalid one', () => {
    const d = dist({ 'a.js': 'x="E2E"+"a".repeat(41)' })
    expect(run(d).status).toBe(0)
    expect(run(d, '--also-regex', '"E2E"\\s*\\+\\s*"a"\\.repeat\\(41\\)').status).toBe(1)
    expect(run(d, '--also-regex', '(').status).toBe(2)
    expect(run(d, '--also-regex').status).toBe(2)
  })

  it('is runnable as the package bin', () => {
    expect(execFileSync('node', [CLI, dist({ 'a.js': 'ok' })], { encoding: 'utf8' })).toContain('1 files clean')
  })
})
