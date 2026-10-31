import browserslist from 'browserslist'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const queries: string[] = createRequire(import.meta.url)('../src/browserslist-config.cjs')
const resolved = browserslist(queries)
const names = new Set(resolved.map((b) => b.split(' ')[0]))

describe('browserslist-config', () => {
  it('covers the engines the support promise names', () => {
    for (const n of ['chrome', 'and_chr', 'edge', 'firefox', 'and_ff', 'safari', 'ios_saf', 'samsung']) expect(names, n).toContain(n)
  })

  it('includes Firefox ESR on top of the last two Firefox versions', () => {
    expect(resolved.filter((b) => b.startsWith('firefox ')).length).toBeGreaterThanOrEqual(2)
  })

  it('excludes the engines that cannot run a wallet SPA', () => {
    for (const n of ['op_mini', 'kaios', 'baidu', 'and_qq', 'and_uc', 'op_mob', 'opera', 'ie']) expect(names, n).not.toContain(n)
  })

  it('is what this repo itself declares (package.json cannot extend a relative path, so it inlines the list)', () => {
    expect(JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).browserslist).toEqual(queries)
  })
})
