// @ts-check
// Accessibility assertion for Playwright: WCAG 2.2 AA is always a hard gate. WCAG AAA (enhanced contrast and so on) is
// `report` (attached to the test as annotations; the default while a repo still has findings) or `gate` (fails the run; a repo
// switches to it in the release that clears its AAA findings, which is the target) or `off`.
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { AXE_TAGS_AA, AXE_TAGS_AAA } from './index.js'

/** @param {import('axe-core').Result[]} violations */
function describe(violations) {
  return violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 6).map((n) => `${n.target.join(' ')} — ${n.failureSummary?.split('\n').slice(0, 3).join(' | ')}`),
  }))
}

/**
 * Fail on any WCAG 2.2 A/AA (or best-practice) violation. AAA findings: `aaa: 'gate'` fails on them, `'report'` (default)
 * attaches them to the test as `aaa` annotations, `'off'` skips the AAA run.
 * @param {import('@playwright/test').Page} page
 * @param {{ include?: string, exclude?: string[], disableRules?: string[], aaa?: 'gate' | 'report' | 'off' }} [options]
 */
export async function expectAccessible(page, options = {}) {
  const build = (/** @type {readonly string[]} */ tags) => {
    let b = new AxeBuilder({ page }).withTags([...tags]).disableRules(options.disableRules ?? [])
    if (options.include) b = b.include(options.include)
    for (const e of options.exclude ?? []) b = b.exclude(e)
    return b
  }
  const { violations } = await build(AXE_TAGS_AA).analyze()
  expect(describe(violations), 'WCAG 2.2 AA violations').toEqual([])
  if (options.aaa === 'off') return
  const aaa = await build(AXE_TAGS_AAA).analyze()
  if (options.aaa === 'gate') {
    expect(describe(aaa.violations), 'WCAG AAA violations').toEqual([])
    return
  }
  for (const v of describe(aaa.violations)) {
    test.info().annotations.push({ type: 'aaa', description: `${v.rule}: ${v.help} (${v.nodes.length} node(s))` })
  }
}
