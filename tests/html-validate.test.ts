import { HtmlValidate } from 'html-validate'
import { describe, expect, it } from 'vitest'
import { htmlValidateConfig } from '../src/html-validate.js'

async function problems(markup: string, fileName = 'A.vue') {
  const v = new HtmlValidate(htmlValidateConfig())
  const report = await v.validateString(markup, fileName)
  return report.results.flatMap((r) => r.messages.map((m) => m.ruleId))
}
const sfc = (template: string) => `<template>\n${template}\n</template>\n`

describe('htmlValidateConfig', () => {
  it('accepts a well-formed accessible template', async () => {
    expect(await problems(sfc('<main><h1>Title</h1><ul role="list"><li>a</li></ul><UiButton type="button">Go</UiButton></main>'))).toEqual([])
  })

  it('refuses invalid nesting (a <p> inside a <ul>)', async () => {
    expect(await problems(sfc('<ul><p>x</p></ul>'))).toContain('element-permitted-content')
  })

  it('refuses an image without alternative text', async () => {
    expect(await problems(sfc('<img src="/a.png">'))).toContain('wcag/h37')
  })

  it('refuses an interactive element inside a button', async () => {
    expect(await problems(sfc('<button type="button"><a href="/x">x</a></button>'))).toContain('element-permitted-content')
  })

  it('accepts PascalCase components and kebab-case custom elements', async () => {
    expect(await problems(sfc('<section><KeepAlive><UiPanel title="t">x</UiPanel></KeepAlive><my-widget /></section>'))).toEqual([])
  })

  it('sees through ui components that render one native element (a UiButton is a button)', async () => {
    expect(await problems(sfc('<UiButton type="button"><a href="/x">x</a></UiButton>'))).toContain('element-permitted-content')
  })

  it('does not crash on a dynamic href (html-validate\'s tel-non-breaking rule does)', async () => {
    const v = new HtmlValidate(htmlValidateConfig())
    const report = await v.validateString(sfc('<a :href="url">Docs</a>'), 'A.vue')
    expect(report.results.flatMap((r) => r.messages.map((m) => m.ruleId))).toEqual([])
  })

  it('lets a repo add elements and rule overrides', async () => {
    const v = new HtmlValidate(htmlValidateConfig({ elements: { uibadge: { inherit: 'span' } }, rules: { 'no-inline-style': 'off' } }))
    const report = await v.validateString(sfc('<UiBadge style="color: red">x</UiBadge>'), 'A.vue')
    expect(report.results.flatMap((r) => r.messages.map((m) => m.ruleId))).toEqual([])
  })
})
