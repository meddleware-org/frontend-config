/**
 * Tests for the "nothing stored before an action" check (`src/storage.js`) against a real Chromium: it names each kind of storage a page
 * writes on load and each other host it asks for, and it accepts exactly the keys it is told to allow.
 */
import { chromium, type Browser, type Page } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { expectNothingStored, readDeviceState, watchOtherHosts } from '../src/storage.js'

// The storage check against a real Chromium: a page served from a fake https origin (storage needs a real origin; `setContent` pages
// have none), with and without each kind of storage.
let browser: Browser
beforeAll(async () => {
  browser = await chromium.launch()
})
afterAll(async () => {
  await browser.close()
})

/** A fake https origin: storage needs a real origin, and `setContent` pages have none. */
const ORIGIN = 'https://site.example'

/**
 * Serve a page whose script is the given text, and load it.
 * @param script - what the page runs on load
 * @returns the loaded page and the other hosts it asked for
 */
const open = async (script: string): Promise<{ page: Page; otherHosts: Set<string> }> => {
  const page = await (await browser.newContext()).newPage()
  await page.route(`${ORIGIN}/**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><title>t</title><main><p>x</p></main><script>${script}</script></html>` }),
  )
  // Any other host is refused, as `offline` does in the real suites; the request is still seen by `watchOtherHosts`.
  await page.route(/^https:\/\/(?!site\.example)/, (route) => route.abort())
  const otherHosts = watchOtherHosts(page)
  await page.goto(`${ORIGIN}/`)
  await page.waitForTimeout(200)
  return { page, otherHosts }
}

describe('expectNothingStored', () => {
  it('passes a page that stores nothing', async () => {
    const { page, otherHosts } = await open('')
    await expectNothingStored(page, { otherHosts })
  })

  it('names each kind of storage a page writes on load', async () => {
    const { page } = await open(`
      localStorage.setItem('mw-color-mode', 'dark')
      sessionStorage.setItem('tab', '1')
      document.cookie = 'seen=1; path=/'
      indexedDB.open('db1')
      caches.open('c1')
    `)
    await page.waitForTimeout(200)
    const state = await readDeviceState(page)
    expect(state).toMatchObject({ localStorage: ['mw-color-mode'], sessionStorage: ['tab'], cookies: ['seen'], caches: ['c1'] })
    expect(state.indexedDB).toContain('db1')
    await expect(expectNothingStored(page)).rejects.toThrow(/before the visitor did anything/)
  })

  it('lets a page keep a key it is allowed, and nothing else', async () => {
    const { page } = await open(`localStorage.setItem('allowed', '1')`)
    await expectNothingStored(page, { allow: ['allowed'] })
  })

  it('names another host the page asked for, even when the request is refused', async () => {
    const { page, otherHosts } = await open(`fetch('https://tracker.example/pixel').catch(() => {})`)
    await page.waitForTimeout(200)
    await expect(expectNothingStored(page, { otherHosts })).rejects.toThrow(/tracker\.example/)
  })
})
