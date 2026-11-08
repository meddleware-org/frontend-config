import { describe, expect, it } from 'vitest'
import { PROFILES, buildCsp, cspForProfile, scriptHashesOf } from '../src/csp.js'

// The policies the frontend images served before the profiles existed (copied from their Dockerfiles, 2026-11-07): the profiles must reproduce them
// exactly, or adopting `mw-sync` would change what a deployed site sends.
const CHAIN = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests"
const STATIC = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests"
const HASHES = ["sha256-2xX7WPApihAEgY57fPwQ4HRaWtCTrsAryoGVYhwtsA0=", "sha256-ng8W1FnGVqbzCCV1hV2EGXSMN/WlYnkoQZy8x1kkcsM="]
const DOCS = `default-src 'self'; script-src 'self' '${HASHES[0]}' '${HASHES[1]}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests`

describe('CSP profiles', () => {
  it('chain reproduces the policy of access-gate-ui, sealed-storage-ui, treasury-ui and dao-ui', () => {
    expect(cspForProfile('chain')).toBe(CHAIN)
  })
  it('chain-wasm adds only wasm-unsafe-eval (walrus-storage-ui, token-issuance-ui, dashboard-ui)', () => {
    expect(cspForProfile('chain-wasm')).toBe(CHAIN.replace("script-src 'self'", "script-src 'self' 'wasm-unsafe-eval'"))
  })
  it('static reproduces the landing page policy', () => {
    expect(cspForProfile('static')).toBe(STATIC)
  })
  it('static-strict (status-ui, roadmap-site) differs only in base-uri and form-action', () => {
    expect(cspForProfile('static-strict')).toBe(STATIC.replace("base-uri 'self'; form-action 'self'", "base-uri 'none'; form-action 'none'"))
  })
  it('console (content-hub-ui) is never framed', () => {
    expect(cspForProfile('console')).toBe(STATIC.replace("frame-ancestors 'self'", "frame-ancestors 'none'"))
  })
  it('docs keeps the inline-script hashes already in the Dockerfile', () => {
    expect(cspForProfile('docs', DOCS)).toBe(DOCS)
    expect(scriptHashesOf(DOCS)).toEqual(HASHES)
    expect(cspForProfile('docs')).not.toContain('sha256-')
  })
  it('no profile allows unsafe-inline for scripts or eval', () => {
    for (const name of Object.keys(PROFILES)) {
      const script = cspForProfile(name).split('; ').find((d) => d.startsWith('script-src '))!
      expect(script).not.toContain("'unsafe-inline'")
      expect(script).not.toContain("'unsafe-eval'")
    }
  })
  it('refuses an unknown profile and quotes bare hashes', () => {
    expect(() => cspForProfile('nope')).toThrow(/unknown CSP profile/)
    expect(buildCsp({ scriptHashes: ['sha256-abc='] })).toContain("script-src 'self' 'sha256-abc='")
  })
})
