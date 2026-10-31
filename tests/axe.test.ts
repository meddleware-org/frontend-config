import { chromium, type Browser } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AXE_TAGS_AA, AXE_TAGS_AAA, BROWSER_PROJECTS } from '../src/index.js'
import { expectAccessible } from '../src/axe.js'

// Drives a real Chromium (CI installs it). `expectAccessible` uses Playwright's `expect`, which works standalone, but `test.info()`
// (the `report` annotation path) only exists inside the Playwright runner, so `report` is exercised by the consumers' specs;
// here the AA gate and the AAA `gate` and `off` modes are.
let browser: Browser
beforeAll(async () => {
  browser = await chromium.launch()
})
afterAll(async () => {
  await browser.close()
})

const page = (body: string) => `<!doctype html><html lang="en"><head><title>t</title></head><body><main>${body}</main></body></html>`

describe('expectAccessible', () => {
  it('passes a page with no WCAG 2.2 AA violations', async () => {
    const p = await (await browser.newContext()).newPage()
    await p.setContent(page('<h1>Title</h1><button type="button">Go</button>'))
    await expectAccessible(p, { aaa: 'off' })
  })

  it('fails on an image without alternative text, and names the rule', async () => {
    const p = await (await browser.newContext()).newPage()
    await p.setContent(page('<h1>Title</h1><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'))
    await expect(expectAccessible(p, { aaa: 'off' })).rejects.toThrow(/image-alt/)
  })

  it('gates on AAA enhanced contrast when asked, and passes AA-only text when not', async () => {
    const aaOnly = '<h1>Title</h1><p style="color:#767676">Grey text on white: 4.54:1, AA but not AAA</p>'
    const p = await (await browser.newContext()).newPage()
    await p.setContent(page(aaOnly))
    await expectAccessible(p, { aaa: 'off' })
    await expect(expectAccessible(p, { aaa: 'gate' })).rejects.toThrow(/color-contrast-enhanced/)
    await p.setContent(page('<h1>Title</h1><p style="color:#595959">Dark grey text on white: 7:1</p>'))
    await expectAccessible(p, { aaa: 'gate' })
  })

  it('can exclude a region or disable a rule', async () => {
    const p = await (await browser.newContext()).newPage()
    await p.setContent(page('<h1>Title</h1><div id="x"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></div>'))
    await expectAccessible(p, { exclude: ['#x'], aaa: 'off' })
    await expectAccessible(p, { disableRules: ['image-alt'], aaa: 'off' })
  })
})

describe('constants', () => {
  it('gate on WCAG 2.2 AA and only report AAA', () => {
    expect(AXE_TAGS_AA).toContain('wcag22aa')
    expect(AXE_TAGS_AA).not.toContain('wcag2aaa')
    expect(AXE_TAGS_AAA).toEqual(['wcag2aaa'])
    expect(BROWSER_PROJECTS).toHaveLength(5)
  })
})
