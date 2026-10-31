// @ts-check
// Playwright side of the shared mock wallet (`@meddleware/wallet-adapter/testing`, registered by an app's e2e build): connect it
// through the app's own wallet dialog, or give it a signer that lives in Node, so a key never enters the page.

/** The address the mock wallet connects with (`MOCK_ADDRESS` in wallet-adapter's testing module). */
export const E2E_ADDRESS = `0x${'a'.repeat(64)}`

/**
 * Connect the mock wallet as a visitor would: open the wallet dialog, choose the wallet, and wait for the dialog to close.
 * @param {import('@playwright/test').Page} page
 * @param {{ wallet?: string, trigger?: string | RegExp }} [options] The wallet's name in the picker; the name of the button that opens the dialog.
 */
export async function connectMockWallet(page, { wallet = 'Test Wallet', trigger = 'Connect wallet' } = {}) {
  await page.getByRole('button', { name: trigger }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: wallet }).click()
  await dialog.waitFor({ state: 'hidden' })
}

/**
 * @typedef {object} NodeSigner
 * @property {(transactionJson: string, chain: string) => Promise<{ bytes: string, signature: string }>} [signTransaction]
 *   Build and sign a transaction (`Transaction.from(json)`); resolves base64 bytes and signature.
 * @property {(message: string) => Promise<{ signature: string }>} [signPersonalMessage] Sign a personal message (base64 bytes).
 */

/**
 * Let the page's mock wallet sign in this Node process. Call it before `page.goto`: the functions are exposed to every page load, and
 * `installE2eWallet` uses them when they exist.
 * @param {import('@playwright/test').Page} page
 * @param {NodeSigner} signer
 * @param {{ address?: string }} [options] The address the wallet connects with: the signer's own, so the transaction's sender and its signature agree.
 */
export async function exposeSigner(page, signer, { address } = {}) {
  if (address) await page.addInitScript((a) => Object.assign(window, { __e2eWalletAddress: a }), address)
  if (signer.signTransaction) await page.exposeFunction('__e2eSignTransaction', signer.signTransaction)
  if (signer.signPersonalMessage) await page.exposeFunction('__e2eSignPersonalMessage', signer.signPersonalMessage)
}
