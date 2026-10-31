import stylelint from 'stylelint'
import { describe, expect, it } from 'vitest'
import { stylelintConfig } from '../src/stylelint.js'

async function warnings(code: string, options?: Parameters<typeof stylelintConfig>[0], codeFilename = 'a.css') {
  const { results } = await stylelint.lint({ code, codeFilename, config: stylelintConfig(options) })
  return results[0]!.warnings.map((w) => ({ rule: w.rule, severity: w.severity }))
}
const rulesOf = (w: { rule: string }[]) => w.map((x) => x.rule)

describe('stylelintConfig', () => {
  it('accepts token-driven CSS', async () => {
    const css = '.a {\n  color: var(--text);\n  background: color-mix(in srgb, var(--accent) 12%, var(--bg));\n  z-index: var(--z-dialog);\n}\n'
    expect(await warnings(css)).toEqual([])
  })

  it('refuses a hex colour', async () => {
    expect(rulesOf(await warnings('.a {\n  color: #fff;\n}\n'))).toContain('color-no-hex')
  })

  it('refuses a literal colour name or function where a token belongs', async () => {
    expect(rulesOf(await warnings('.a {\n  color: rebeccapurple;\n  border-color: rgb(0 0 0 / 50%);\n}\n'))).toContain(
      'scale-unlimited/declaration-strict-value',
    )
  })

  it('refuses a literal z-index', async () => {
    expect(rulesOf(await warnings('.a {\n  z-index: 50;\n}\n'))).toContain('scale-unlimited/declaration-strict-value')
  })

  it('allows transparent, currentColor and inherit', async () => {
    expect(await warnings('.a {\n  color: inherit;\n  border-color: transparent;\n  fill: currentColor;\n}\n')).toEqual([])
  })

  it('lets a repo start the token rule as a warning, or switch it off', async () => {
    const css = '.a {\n  z-index: 50;\n}\n'
    expect((await warnings(css, { tokens: 'warning' })).find((w) => w.rule === 'scale-unlimited/declaration-strict-value')?.severity).toBe('warning')
    expect(rulesOf(await warnings(css, { tokens: false }))).not.toContain('scale-unlimited/declaration-strict-value')
  })

  it('refuses removing the focus outline, but does not demand a focus twin for every hover style', async () => {
    expect(rulesOf(await warnings('.a:focus {\n  outline: none;\n}\n'))).toContain('a11y/no-outline-none')
    expect(rulesOf(await warnings('.a:focus-visible {\n  outline: 0;\n}\n'))).toContain('a11y/no-outline-none')
    expect(rulesOf(await warnings('.a:focus-visible {\n  outline-color: transparent;\n}\n'))).toContain('a11y/no-outline-none')
    expect(await warnings('.a:hover {\n  color: var(--accent);\n}\n')).toEqual([])
    // An alternative indicator is accepted: a box-shadow ring, or an outline drawn on a pseudo-element (a card-wide ring).
    expect(await warnings('.a:focus-visible {\n  outline: none;\n  box-shadow: 0 0 0 var(--space-4xs) var(--focus-ring);\n}\n')).toEqual([])
    expect(await warnings('.a:focus-visible::after {\n  outline: 2px solid var(--focus-ring);\n}\n')).toEqual([])
  })

  it('leaves reduced motion to the global rule in the ui reset', async () => {
    expect(rulesOf(await warnings('.a {\n  animation: spin 1s linear infinite;\n}\n'))).not.toContain('a11y/media-prefers-reduced-motion')
  })

  it('ignores the features that degrade harmlessly (resize, system font keywords)', async () => {
    const css = '.a {\n  resize: vertical;\n  font-family: ui-monospace, monospace;\n}\n'
    expect(await warnings(css, { browsers: ['ios_saf 27', 'firefox 159'] })).toEqual([])
  })

  it('lints the <style> block of a Vue SFC', async () => {
    const sfc = '<template><p class="a">x</p></template>\n<style scoped>\n.a {\n  color: #fff;\n}\n</style>\n'
    expect(rulesOf(await warnings(sfc, undefined, 'A.vue'))).toContain('color-no-hex')
  })

  it('understands the Vue scoped-style pseudo-classes', async () => {
    const sfc = '<template><p class="a">x</p></template>\n<style scoped>\n.a :deep(.b) {\n  color: var(--text);\n}\n</style>\n'
    expect(await warnings(sfc, undefined, 'A.vue')).toEqual([])
  })

  it('checks CSS features against the browsers it is given, as an error by default', async () => {
    const css = '.a:has(b) {\n  gap: var(--space-xs);\n}\n'
    const w = await warnings(css, { browsers: ['ie 11'] })
    expect(w.length).toBeGreaterThan(0)
    expect(w.every((x) => x.rule === 'plugin/no-unsupported-browser-features' && x.severity === 'error')).toBe(true)
    const soft = await warnings(css, { browsers: ['ie 11'], compat: 'warning' })
    expect(soft.every((x) => x.severity === 'warning')).toBe(true)
  })

  it('passes modern CSS on the shared support promise (this repo resolves it from its own package.json)', async () => {
    expect(await warnings('.a:has(b) {\n  gap: var(--space-xs);\n  container-type: inline-size;\n}\n')).toEqual([])
  })
})
