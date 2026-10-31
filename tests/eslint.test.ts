import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import { vueApp } from '../src/eslint.js'

function linter(options: Parameters<typeof vueApp>[0] = { name: 't' }) {
  return new ESLint({ cwd: process.cwd(), overrideConfigFile: true, overrideConfig: vueApp(options) as never })
}
async function rules(code: string, filePath: string, options?: Parameters<typeof vueApp>[0]): Promise<string[]> {
  const [result] = await linter(options).lintText(code, { filePath })
  return result!.messages.map((m) => m.ruleId ?? `fatal: ${m.message}`)
}
const sfc = (template: string) => `<script setup lang="ts">\nconst f = (): void => {}\nf()\n</script>\n<template>\n${template}\n</template>\n`

describe('vueApp accessibility rules', () => {
  it('refuses an image without alternative text', async () => {
    expect(await rules(sfc('<img src="/a.png">'), 'src/ExampleView.vue')).toContain('vuejs-accessibility/alt-text')
  })

  it('refuses a click handler on a non-interactive element', async () => {
    expect(await rules(sfc('<div @click="f">x</div>'), 'src/ExampleView.vue')).toContain('vuejs-accessibility/click-events-have-key-events')
  })

  it('accepts a label that nests its control, and a button', async () => {
    expect(await rules(sfc('<label>Name <input type="text"></label>\n<button type="button" @click="f">Go</button>'), 'src/ExampleView.vue')).toEqual([])
  })

  it('refuses a control with no label', async () => {
    expect(await rules(sfc('<input type="text">'), 'src/ExampleView.vue')).toContain('vuejs-accessibility/form-control-has-label')
  })

  it('accepts a control inside UiFormField, which renders its label', async () => {
    const t = '<UiFormField id="x" label="Name"><template #default="{ attrs }"><input type="text" v-bind="attrs"></template></UiFormField>'
    expect(await rules(sfc(t), 'src/ExampleView.vue')).toEqual([])
  })

  it('accepts a label nesting a UiSelect', async () => {
    expect(await rules(sfc('<label>Network <UiSelect v-model="n" /></label>'), 'src/ExampleView.vue')).not.toContain('vuejs-accessibility/label-has-for')
  })

  it('leaves the deliberate role="list" workaround alone', async () => {
    expect(await rules(sfc('<ul role="list"><li>a</li></ul>'), 'src/ExampleView.vue')).toEqual([])
  })

  it('treats an underscore-prefixed unused variable as intentional', async () => {
    expect(await rules('const _x = 1\nexport {}\n', 'src/a.ts')).toEqual([])
    expect(await rules('const x = 1\nexport {}\n', 'src/a.ts')).toContain('@typescript-eslint/no-unused-vars')
  })
})

describe('vueApp compatibility and boundary', () => {
  it('runs eslint-plugin-compat on source, not on tests', async () => {
    const e = linter()
    expect(Object.keys((await e.calculateConfigForFile('src/a.ts'))!.rules ?? {})).toContain('compat/compat')
    expect(Object.keys((await e.calculateConfigForFile('tests/a.test.ts'))!.rules ?? {})).not.toContain('compat/compat')
  })

  const tx = "import { Transaction } from '@mysten/sui/transactions'\nexport const t = new Transaction()\n"
  it('applies the Sui chain-access boundary only when asked', async () => {
    expect(await rules(tx, 'src/a.ts')).toEqual([])
    const withBoundary = await rules(tx, 'src/a.ts', { name: 't', sui: true })
    expect(withBoundary).toEqual(expect.arrayContaining(['@typescript-eslint/no-restricted-imports', 'no-restricted-syntax']))
  })

  it('lets a repo add its own ignores and extra config', async () => {
    const e = linter({ name: 't', ignores: ['docs/api/**'] })
    expect(await e.isPathIgnored('docs/api/x.ts')).toBe(true)
    expect(await e.isPathIgnored('src/x.ts')).toBe(false)
  })
})
