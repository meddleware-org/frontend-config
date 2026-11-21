// @ts-check
// The "nothing before an action" check every app and site runs: open a page in a fresh browser, let it settle, and fail if the page has
// left anything on the device although the visitor did nothing (cookies, localStorage, sessionStorage, IndexedDB, Cache Storage, a
// service worker) or asked another host for anything. PECR reg. 6 and Schedule A1 (in force 5 February 2026) allow storage without
// consent only for what the person asks for; storing on load is never that. The workspace's `docs/legal/STORAGE_LEDGER.md` lists every
// entry the platform may write, each after an action; a page that needs to write on load names the key in `allow`, and the key needs a
// ledger row first.
//
//   // e2e/storage.spec.ts
//   import { defineStorageSuite } from '@meddleware/frontend-config/storage'
//   defineStorageSuite({ home: '/', docs: '/guide/' })
import { expect, test } from '@playwright/test'
import { offline } from './look.js'

/**
 * @typedef {object} DeviceState What a page has left on the device and asked of other hosts.
 * @property {string[]} cookies Cookie names in the browser context.
 * @property {string[]} localStorage `localStorage` keys of the page's origin.
 * @property {string[]} sessionStorage `sessionStorage` keys of the page's origin.
 * @property {string[]} indexedDB IndexedDB database names (where the browser can list them).
 * @property {string[]} caches Cache Storage cache names.
 * @property {number} serviceWorkers Service worker registrations.
 * @property {string[]} otherHosts Hosts other than the page's own that the page requested.
 */

/**
 * Read everything a page could have stored, plus the other hosts it asked for (recorded by {@link watchOtherHosts}).
 * @param {import('@playwright/test').Page} page - the page to inspect
 * @param {Set<string>} [otherHosts] - the hosts `watchOtherHosts` recorded
 * @returns {Promise<DeviceState>} everything found
 */
export async function readDeviceState(page, otherHosts = new Set()) {
  const inPage = await page.evaluate(async () => {
    /**
     * Run a read that a browser may refuse (storage blocked, an API missing) and fall back instead of failing the whole check.
     * @param {() => unknown} f - the read
     * @param {unknown} [fallback] - what to return when it throws
     */
    const safe = async (f, fallback = /** @type {unknown} */ ([])) => {
      try {
        return await f()
      } catch {
        return fallback
      }
    }
    return {
      localStorage: /** @type {string[]} */ (await safe(() => Object.keys(window.localStorage))),
      sessionStorage: /** @type {string[]} */ (await safe(() => Object.keys(window.sessionStorage))),
      indexedDB: /** @type {string[]} */ (
        await safe(async () => (typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).map((d) => d.name ?? '') : []))
      ),
      caches: /** @type {string[]} */ (await safe(async () => (typeof caches === 'undefined' ? [] : caches.keys()))),
      serviceWorkers: /** @type {number} */ (
        await safe(async () => ('serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0), 0)
      ),
    }
  })
  const cookies = (await page.context().cookies()).map((c) => c.name)
  return { cookies, ...inPage, otherHosts: [...otherHosts].sort() }
}

/**
 * Record every host other than the page's own that the page requests from now on (they are still refused by `offline`).
 * @param {import('@playwright/test').Page} page
 * @returns {Set<string>}
 */
export function watchOtherHosts(page) {
  /** @type {Set<string>} */
  const hosts = new Set()
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return
    // Before the first navigation the page is about:blank, so its own host is that of the request itself.
    const own = new URL(page.url() === 'about:blank' ? request.url() : page.url()).host
    if (url.host !== own && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') hosts.add(url.host)
  })
  return hosts
}

/**
 * Fail if the page has stored anything, or asked another host for anything, other than the `allow`ed keys and cookie names.
 * @param {import('@playwright/test').Page} page - the page to inspect
 * @param {{ allow?: string[], otherHosts?: Set<string> }} [options] - `allow`: keys and cookie names a ledger row allows; `otherHosts`: from `watchOtherHosts`
 */
export async function expectNothingStored(page, { allow = [], otherHosts } = {}) {
  const state = await readDeviceState(page, otherHosts)
  const unexpected = (/** @type {string[]} */ names) => names.filter((n) => !allow.includes(n))
  expect(
    {
      cookies: unexpected(state.cookies),
      localStorage: unexpected(state.localStorage),
      sessionStorage: unexpected(state.sessionStorage),
      indexedDB: unexpected(state.indexedDB),
      caches: unexpected(state.caches),
      serviceWorkers: state.serviceWorkers,
      otherHosts: state.otherHosts,
    },
    'the page stored something, or asked another host for something, before the visitor did anything (docs/legal STORAGE_LEDGER)',
  ).toEqual({ cookies: [], localStorage: [], sessionStorage: [], indexedDB: [], caches: [], serviceWorkers: 0, otherHosts: [] })
}

/**
 * One test per page: open it in a fresh browser context with no network beyond localhost, let it settle, and expect nothing stored.
 * @param {Record<string, string>} pages Name → path (relative to the project's `baseURL`).
 * @param {{ allow?: string[], settleMs?: number }} [options] `allow`: keys a page may write on load (each needs a ledger row); `settleMs`:
 *   how long to wait after the network is idle for late scripts (default 500).
 */
export function defineStorageSuite(pages, { allow = [], settleMs = 500 } = {}) {
  test.describe('stores nothing before the visitor acts (PECR Sch. A1)', () => {
    for (const [name, path] of Object.entries(pages)) {
      test(name, async ({ page }) => {
        await offline(page)
        const otherHosts = watchOtherHosts(page)
        await page.goto(path, { waitUntil: 'networkidle' })
        await page.waitForTimeout(settleMs)
        await expectNothingStored(page, { allow, otherHosts })
      })
    }
  })
}
