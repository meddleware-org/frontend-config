import { chromium, type Browser, type Page } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { expectKeyboardFocusVisible, expectNoHorizontalScroll, expectNoRunningAnimations } from '../src/a11y.js'

// The three assertions the sweep is built from, against a real Chromium: each fails for the fault it names and passes without it.
let browser: Browser
beforeAll(async () => {
  browser = await chromium.launch()
})
afterAll(async () => {
  await browser.close()
})

const open = async (body: string, head = ''): Promise<Page> => {
  const page = await (await browser.newContext({ viewport: { width: 400, height: 600 } })).newPage()
  await page.setContent(`<!doctype html><html lang="en"><head><title>t</title><style>${head}</style></head><body><main>${body}</main></body></html>`)
  return page
}

describe('expectNoHorizontalScroll', () => {
  it('passes a page that fits and fails one wider than the viewport', async () => {
    await expectNoHorizontalScroll(await open('<p>fits</p>'))
    await expect(expectNoHorizontalScroll(await open('<div style="width:900px">wide</div>'))).rejects.toThrow(/scrolls sideways/)
  })
})

describe('expectNoRunningAnimations', () => {
  const css = '@keyframes spin { to { transform: rotate(1turn) } } .s { animation: spin 1s linear infinite }'
  it('passes a still page and names a running animation', async () => {
    await expectNoRunningAnimations(await open('<p>still</p>', css))
    await expect(expectNoRunningAnimations(await open('<p class="s">spin</p>', css))).rejects.toThrow(/s/)
  })
})

describe('expectKeyboardFocusVisible', () => {
  const ring = 'a, button { outline: 2px solid blue }'
  it('passes controls that show focus, and ends when the tab order does', async () => {
    await expectKeyboardFocusVisible(await open('<a href="#a">one</a><button>two</button>', ring))
  })

  it('fails a control that hides its focus indicator', async () => {
    await expect(expectKeyboardFocusVisible(await open('<a href="#a">one</a><button>two</button>', 'button:focus { outline: none }'))).rejects.toThrow(/no focus indicator/)
  })

  it('accepts a visually hidden control whose label shows the focus', async () => {
    const hidden = 'input { position: absolute; width: 1px; height: 1px; clip-path: inset(50%) } label:focus-within { outline: 2px solid blue }'
    await expectKeyboardFocusVisible(await open('<label><input type="radio" name="a"> One</label><label><input type="radio" name="b"> Two</label>', hidden))
    await expect(expectKeyboardFocusVisible(await open('<label><input type="radio" name="a"> One</label>', 'input { position: absolute; width: 1px; height: 1px; clip-path: inset(50%) }'))).rejects.toThrow(/no focus indicator/)
  })

  describe('focus not obscured (WCAG 2.4.11)', () => {
    const ring = 'a { outline: 2px solid blue; display: block; width: 100px; margin-bottom: 8px }'
    const bar = (css: string) => `<div style="position:fixed;background:#ccc;${css}">bar</div>`

    it('fails a stop that a fixed bar covers entirely, going forward', async () => {
      const page = await open(`<a href="#a">one</a><a href="#b">two</a>${bar('left:0;right:0;top:0;height:80px')}`, ring)
      await expect(expectKeyboardFocusVisible(page)).rejects.toThrow(/hidden behind other content when focused/)
    })

    it('fails a stop that sticky chrome covers, reached backwards', async () => {
      const filler = '<div style="height:1500px">filler</div>'
      const page = await open(`${filler}<a href="#a">one</a>${bar('left:0;right:0;bottom:0;height:600px;pointer-events:auto')}`, ring)
      await expect(expectKeyboardFocusVisible(page)).rejects.toThrow(/hidden behind other content/)
    })

    it('passes a stop that is only partly covered (2.4.11 asks for not entirely hidden)', async () => {
      const page = await open(`<a href="#a" style="width:300px">wide link</a>${bar('left:0;top:0;width:60px;height:600px')}`, ring.replace('width: 100px', 'width: 300px'))
      await expectKeyboardFocusVisible(page)
    })

    it('passes a stop inside the layer that is on top (a dialog holding its own controls)', async () => {
      const page = await open(`<div style="position:fixed;inset:0;background:#fff"><a href="#a">in the dialog</a></div>`, ring)
      await expectKeyboardFocusVisible(page)
    })
  })

  it('fails when there is nothing to tab to', async () => {
    await expect(expectKeyboardFocusVisible(await open('<p>text only</p>'))).rejects.toThrow(/no keyboard stops/)
  })
})
