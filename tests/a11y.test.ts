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
      await expect(expectKeyboardFocusVisible(page)).rejects.toThrow(/hidden behind div\.?.* when focused/)
    })

    it('fails a stop that sticky chrome covers, reached backwards', async () => {
      const filler = '<div style="height:1500px">filler</div>'
      const page = await open(`${filler}<a href="#a">one</a>${bar('left:0;right:0;bottom:0;height:600px;pointer-events:auto')}`, ring)
      await expect(expectKeyboardFocusVisible(page)).rejects.toThrow(/hidden behind div.* when (focused|reached backwards)/)
    })

    it('ignores a tooltip that a stale pointer position would keep open (the pointer is parked first)', async () => {
      const css = 'a { outline: 2px solid blue; display: block; width: 100px; height: 30px; margin-bottom: 8px } #tip { display: none; position: fixed; left: 0; top: 0; width: 400px; height: 300px; background: #ccc } #one:hover ~ #tip { display: block }'
      const page = await open('<a id="one" href="#a">one</a><a href="#b">two</a><div id="tip">tip</div>', css)
      await page.mouse.move(40, 25) // over the first link: its tip opens and covers both
      await expectKeyboardFocusVisible(page)
    })

    it('judges where an animated scroll comes to rest, not where it passes through', async () => {
      const filler = '<div style="height:1200px">filler</div>'
      const css = 'html { scroll-behavior: smooth; scroll-padding-top: 130px } header { position: sticky; top: 0; height: 100px; background: #ccc } a { outline: 2px solid blue; display: block; width: 100px; margin-bottom: 8px }'
      const page = await open(`<header>site</header><a href="#a">one</a>${filler}<a href="#b">two</a>${filler}<a href="#c">three</a>`, css)
      await expectKeyboardFocusVisible(page)
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

  it('counts the stops of a page whose focus starts on its last control (the first Tab only wraps)', async () => {
    const page = await open('<a href="#a">one</a><button id="last">two</button>', 'a, button { outline: 2px solid blue }')
    await page.focus('#last')
    await expectKeyboardFocusVisible(page)
    const bad = await open('<a href="#a">one</a><button id="last">two</button>', 'button:focus { outline: none }')
    await bad.focus('#last')
    await expect(expectKeyboardFocusVisible(bad)).rejects.toThrow(/no focus indicator/)
  })

  it('does not end the walk at a repeated label: two links with the same text are two stops', async () => {
    const css = 'a { outline: 2px solid blue; display: block; width: 100px; margin-bottom: 8px } #bar { position: fixed; left: 0; right: 0; bottom: 0; height: 80px; background: #ccc }'
    // "Guide" appears several times (a menu, a sidebar and an outline, as on a VitePress page); the link that matters comes after them and is
    // covered. (The old walk stopped at the second repeated label, so it never reached it.)
    const page = await open('<a href="#a">Guide</a><a href="#b">Intro</a><a href="#d">Guide</a><a href="#e">Intro</a><a href="#f">Guide</a><a href="#g">Intro</a><div style="height:300px"></div><a href="#c" style="margin-bottom:0">Legal</a><div id="bar">bar</div>', css)
    await page.setViewportSize({ width: 400, height: 380 })
    await expect(expectKeyboardFocusVisible(page)).rejects.toThrow(/Legal.*hidden behind/)
  })

  it('fails a page with more stops than the cap instead of passing the rest unchecked', async () => {
    const page = await open('<a href="#1">a</a><a href="#2">b</a><a href="#3">c</a><a href="#4">d</a>', 'a, button { outline: 2px solid blue }')
    await expect(expectKeyboardFocusVisible(page, { maxStops: 3 })).rejects.toThrow(/more than 3 stops/)
    await expectKeyboardFocusVisible(page, { maxStops: 6 })
  })

  it('fails when there is nothing to tab to', async () => {
    await expect(expectKeyboardFocusVisible(await open('<p>text only</p>'))).rejects.toThrow(/no keyboard stops/)
  })
})
