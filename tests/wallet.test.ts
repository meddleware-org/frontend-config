import { chromium, type Browser } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { E2E_ADDRESS, connectMockWallet, exposeSigner } from '../src/wallet.js'

// A real Chromium, with a page that behaves like the wallet dialog: a trigger opens a modal listing wallets, choosing one closes it.
let browser: Browser
beforeAll(async () => {
  browser = await chromium.launch()
})
afterAll(async () => {
  await browser.close()
})

const dialogPage = `<!doctype html><html lang="en"><head><title>t</title></head><body><main>
<button id="open" type="button">Connect wallet</button><p id="who"></p>
<dialog id="d"><h2>Select wallet</h2><menu><li><button type="button" id="a">Other Wallet</button></li><li><button type="button" id="b">Test Wallet</button></li></menu></dialog>
<script>
document.getElementById('open').onclick = () => document.getElementById('d').showModal()
for (const id of ['a', 'b']) document.getElementById(id).onclick = (e) => { document.getElementById('who').textContent = e.target.textContent; document.getElementById('d').close() }
</script></main></body></html>`

describe('connectMockWallet', () => {
  it('opens the dialog, picks the named wallet and waits for it to close', async () => {
    const page = await (await browser.newContext()).newPage()
    await page.setContent(dialogPage)
    await connectMockWallet(page)
    expect(await page.locator('#who').textContent()).toBe('Test Wallet')
    expect(await page.locator('dialog').evaluate((d: HTMLDialogElement) => d.open)).toBe(false)
  })

  it('takes another wallet name and another trigger', async () => {
    const page = await (await browser.newContext()).newPage()
    await page.setContent(dialogPage.replace('>Connect wallet<', '>Sign in<'))
    await connectMockWallet(page, { wallet: 'Other Wallet', trigger: 'Sign in' })
    expect(await page.locator('#who').textContent()).toBe('Other Wallet')
  })
})

describe('exposeSigner', () => {
  it('lets the page call the Node signer, on this load and after a navigation', async () => {
    const page = await (await browser.newContext()).newPage()
    await exposeSigner(page, {
      signTransaction: async (json, chain) => ({ bytes: `bytes:${json}`, signature: `sig:${chain}` }),
      signPersonalMessage: async (m) => ({ signature: `msg:${m}` }),
    })
    await page.setContent('<main></main>')
    const call = () =>
      page.evaluate(async () => {
        const w = window as unknown as Record<string, (...a: string[]) => Promise<unknown>>
        return [await w.__e2eSignTransaction!('{}', 'sui:testnet'), await w.__e2eSignPersonalMessage!('AQID')]
      })
    expect(await call()).toEqual([{ bytes: 'bytes:{}', signature: 'sig:sui:testnet' }, { signature: 'msg:AQID' }])
    await page.goto('data:text/html,<main></main>')
    expect(await call()).toEqual([{ bytes: 'bytes:{}', signature: 'sig:sui:testnet' }, { signature: 'msg:AQID' }])
  })

  it('tells the page which address to connect as', async () => {
    const page = await (await browser.newContext()).newPage()
    await exposeSigner(page, { signPersonalMessage: async () => ({ signature: 's' }) }, { address: '0xabc' })
    await page.goto('data:text/html,<main></main>')
    expect(await page.evaluate(() => (window as never as Record<string, unknown>).__e2eWalletAddress)).toBe('0xabc')
  })

  it('exposes only what it was given', async () => {
    const page = await (await browser.newContext()).newPage()
    await exposeSigner(page, { signPersonalMessage: async () => ({ signature: 's' }) })
    await page.setContent('<main></main>')
    expect(await page.evaluate(() => [typeof (window as never as Record<string, unknown>).__e2eSignTransaction, typeof (window as never as Record<string, unknown>).__e2eSignPersonalMessage])).toEqual(['undefined', 'function'])
  })

  it('names the address the mock wallet connects with', () => {
    expect(E2E_ADDRESS).toBe(`0x${'a'.repeat(64)}`)
  })
})
