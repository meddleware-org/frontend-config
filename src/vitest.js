// @ts-check
// Vitest settings for a repo whose code imports the Meddleware UI libraries. Those packages ship ES modules that import their own `.css`
// files (each component brings its CSS), and Node cannot import a `.css` file. Vitest runs `node_modules` dependencies through Node by
// default, so the import fails: the libraries have to go through Vite instead, which also gives them the SAME copy of Vue as the code
// under test (a second copy breaks reactivity across the boundary, which is why tests used to mock `@meddleware/ui`).
//
//   // vitest.config.ts (and, in a jsdom test that renders a dialog: beforeAll(installDialogShim))
//   import { inlineMeddleware } from '@meddleware/frontend-config/vitest'
//   export default defineConfig({
//     plugins: [vue()],
//     resolve: { dedupe: ['vue', '@vue/test-utils'] },
//     test: { server: { deps: { inline: inlineMeddleware } } },
//   })

/**
 * Packages to process through Vite in tests: the ones that import CSS or `.vue` files. Vitest matches these against the module's resolved
 * file path (`…/node_modules/@meddleware/ui/dist/…`), not the package name, so the patterns match the path.
 */
export const inlineMeddleware = [/[\\/]@meddleware[\\/](ui|wallet-adapter|walrus-storage-kit|design-tokens)[\\/]/]

/**
 * jsdom does not implement `<dialog>` modality (`showModal`, `close`, `returnValue`). This minimal shim models the parts `UiDialog` relies on:
 * the `open` attribute, `returnValue`, and a `close` event on closing. Call it once (`beforeAll(installDialogShim)`) in a jsdom test that
 * renders a dialog; the browser's real behaviour (top layer, inert background) is checked by the Playwright suites, not jsdom.
 */
export function installDialogShim() {
  if (typeof HTMLDialogElement === 'undefined') return // a node-environment test file: there is no DOM to patch
  const proto = /** @type {HTMLDialogElement & { _rv?: string }} */ (HTMLDialogElement.prototype)
  if (typeof proto.showModal === 'function') return
  if (!('returnValue' in proto)) {
    Object.defineProperty(proto, 'returnValue', {
      configurable: true,
      get: /** @this {{ _rv?: string }} */ function () {
        return this._rv ?? ''
      },
      set: /** @this {{ _rv?: string }} */ function (/** @type {string} */ v) {
        this._rv = v
      },
    })
  }
  proto.showModal = /** @this {HTMLDialogElement} */ function () {
    this.returnValue = ''
    this.setAttribute('open', '')
  }
  proto.show = proto.showModal
  proto.close = /** @this {HTMLDialogElement} */ function (returnValue) {
    if (!this.hasAttribute('open')) return
    if (returnValue !== undefined) this.returnValue = returnValue
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

/**
 * The Vitest configuration of a MeddleWare Vue repository: jsdom, `tests/**\/*.test.ts`, a single copy of Vue for the code under test and
 * `@vue/test-utils`, and the UI packages processed through Vite ({@link inlineMeddleware}).
 *
 * ```ts
 * import vue from '@vitejs/plugin-vue'
 * export default defineConfig(vueTestConfig({ plugins: [vue()] }))
 * ```
 *
 * @param {object} options
 * @param {import('vite').PluginOption[]} options.plugins The Vue plugin (and any other the tests need).
 * @param {import('vitest/config').TestUserConfig} [options.test] Overrides merged into `test` (`include`, `setupFiles`, `environment` …).
 * @returns {import('vitest/config').ViteUserConfig & { test: import('vitest/config').TestUserConfig }}
 */
export function vueTestConfig({ plugins, test = {} }) {
  const inline = test.server?.deps?.inline
  return {
    plugins,
    resolve: { dedupe: ['vue', '@vue/test-utils'] },
    test: {
      environment: 'jsdom',
      include: ['tests/**/*.test.ts'],
      exclude: ['node_modules/**'],
      ...test,
      server: { ...test.server, deps: { ...test.server?.deps, inline: inline === true ? true : [...inlineMeddleware, ...(inline ?? [])] } },
    },
  }
}
