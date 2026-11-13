// @ts-check
// Vite build target derived from the repo's browserslist, so the shipped JS and CSS are transformed for exactly the browsers the
// support promise names (instead of `esnext`, or Vite's own default). In vite.config.ts:
//   import { viteTarget } from '@meddleware/frontend-config/vite'
//   export default defineConfig({ build: { target: viteTarget() } })
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import browserslistToEsbuild from 'browserslist-to-esbuild'

/** @param {string | string[]} [queries] Browserslist queries; default: the repo's own configuration. */
export function viteTarget(queries) {
  return browserslistToEsbuild(queries)
}

/** Resolve a package file from the app's own directory, where `@meddleware/ui` and the tokens are installed. */
function resolveFromApp(/** @type {string} */ specifier) {
  return createRequire(join(process.cwd(), 'noop.js')).resolve(specifier)
}

/**
 * The colour mode and the browser chrome, before the first paint: a Vite plugin for an app's `index.html`.
 *
 * - Serves `@meddleware/ui`'s `theme-init.js` at `/theme-init.js` (dev) and emits it into the build, and loads it as the first,
 *   render-blocking script in `<head>`. It applies the saved (or default) colour mode and the season to `<html>` before anything
 *   paints, so a page never flashes the wrong theme while its JavaScript loads. It is a same-origin file, so the CSP needs no hash
 *   and no `'unsafe-inline'`.
 * - Adds `<meta name="color-scheme" content="light dark">` (native controls and scrollbars follow the theme) and the browser-chrome
 *   `theme-color` for each colour mode, from the design tokens' page background.
 *
 * ```ts
 * plugins: [vue(), themeInit({ default: 'dark' })]
 * ```
 *
 * @param {object} [options]
 * @param {'light' | 'dark' | 'system'} [options.default] The mode a first visit gets (a saved choice always wins). Default `system`.
 * @param {string} [options.scriptPath] The script to serve (default: `@meddleware/ui/theme-init.js` as installed in the app).
 * @param {{ light: string, dark: string }} [options.colors] The `theme-color` values (default: the tokens' page backgrounds).
 * @returns {import('vite').Plugin}
 */
export function themeInit({ default: mode = 'system', scriptPath, colors } = {}) {
  const read = () => readFileSync(scriptPath ?? resolveFromApp('@meddleware/ui/theme-init.js'), 'utf8')
  const chrome = () => {
    if (colors) return colors
    const { semantic } = JSON.parse(readFileSync(resolveFromApp('@meddleware/design-tokens/tokens.json'), 'utf8'))
    return { light: semantic.light.bg, dark: semantic.dark.bg }
  }
  return {
    name: 'meddleware:theme-init',
    configureServer(server) {
      server.middlewares.use('/theme-init.js', (_req, res) => {
        res.setHeader('content-type', 'text/javascript')
        res.end(read())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'theme-init.js', source: read() })
    },
    transformIndexHtml() {
      const { light, dark } = chrome()
      return [
        { tag: 'script', attrs: { src: '/theme-init.js', 'data-default': mode }, injectTo: 'head-prepend' },
        { tag: 'meta', attrs: { name: 'color-scheme', content: 'light dark' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: light, media: '(prefers-color-scheme: light)' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: dark, media: '(prefers-color-scheme: dark)' }, injectTo: 'head' },
      ]
    },
  }
}

/**
 * The end-to-end build mode registers a mock wallet and a stub chain client in the app (`@meddleware/wallet-adapter/testing`), which must
 * never reach a production build. The app's entry loads it only when `import.meta.env.MODE === 'e2e' && import.meta.env.VITE_E2E === '1'`
 * (both static, so every other build drops the block); this makes `VITE_E2E=1` outside `--mode e2e` a build error instead of a silent no-op.
 *
 * ```ts
 * export default defineConfig(({ mode }) => { assertE2eOnlyInE2eMode(mode, process.env); return { … } })
 * ```
 *
 * @param {string} mode Vite's mode.
 * @param {Record<string, string | undefined>} env The environment (default: the process's).
 */
export function assertE2eOnlyInE2eMode(mode, env = process.env) {
  if (env.VITE_E2E && mode !== 'e2e') {
    throw new Error(`VITE_E2E is set but the build mode is "${mode}": the end-to-end build is \`vite build --mode e2e\`, and nothing else may include the test wallet.`)
  }
}

/**
 * The Vite configuration every Meddleware tool app shares: the browserslist build target, the colour mode and season before first paint
 * ({@link themeInit}), the e2e-build guard ({@link assertE2eOnlyInE2eMode}), and `@meddleware/wallet-adapter` excluded from dependency
 * pre-bundling. The wallet adapter ships TS and `.vue` source and holds the shared wallet singleton; pre-bundling would put its TS in
 * `.vite/deps` while its `.vue` files (which esbuild cannot bundle) are served raw and import the raw module, so dev would run two
 * singletons and the guard and the app would see different connection state.
 *
 * ```ts
 * import vue from '@vitejs/plugin-vue'
 * export default meddlewareApp({ plugins: [vue()] })
 * ```
 *
 * @param {object} options
 * @param {import('vite').PluginOption[]} options.plugins The app's plugins (`vue()` …); `themeInit` is added after them.
 * @param {'light' | 'dark' | 'system'} [options.theme] The mode a first visit gets (default `dark`, the brand default).
 * @param {boolean} [options.wallet] The app uses `@meddleware/wallet-adapter` (default true): keep it out of pre-bundling.
 * @param {string} [options.name] The app's name for the web manifest (default `Meddleware`).
 * @param {import('vite').UserConfig} [options.config] Anything else (`base`, `build.rollupOptions`, `server` …); `build` is merged.
 * @returns {import('vite').UserConfigFnObject}
 */
export function meddlewareApp({ plugins, theme = 'dark', wallet = true, name, config = {} }) {
  return ({ mode }) => {
    assertE2eOnlyInE2eMode(mode)
    return {
      ...config,
      build: { target: viteTarget(), ...config.build },
      plugins: [...plugins, themeInit({ default: theme }), brandIcons({ name })],
      ...(wallet ? { optimizeDeps: { ...config.optimizeDeps, exclude: ['@meddleware/wallet-adapter', ...(config.optimizeDeps?.exclude ?? [])] } } : {}),
    }
  }
}

/** The brand files `@meddleware/ui` publishes (`@meddleware/ui/brand/*`), by served name. */
const BRAND_FILES = /** @type {const} */ ({
  'favicon.svg': 'image/svg+xml',
  'favicon.ico': 'image/x-icon',
  'apple-touch-icon.png': 'image/png',
  'icon-192.png': 'image/png',
  'icon-512.png': 'image/png',
})

/**
 * The favicon set of the company mark (the Kopimi "K"), for an app's `index.html`: serves the files from `@meddleware/ui` in dev, emits them
 * into the build at the site root (`/favicon.svg`, `/favicon.ico`, `/apple-touch-icon.png`, `/icon-192.png`, `/icon-512.png`, `/site.webmanifest`)
 * and adds the `<link>` tags. An app keeps no icon of its own (`mw-sync --check` fails on a `public/favicon.*`), and its `index.html` has no
 * `<link rel="icon">`.
 *
 * @param {object} [options]
 * @param {string} [options.name] The app's name, for the web manifest. Default `Meddleware`.
 * @returns {import('vite').Plugin}
 */
export function brandIcons({ name = 'Meddleware' } = {}) {
  const read = (/** @type {string} */ file) => readFileSync(resolveFromApp(`@meddleware/ui/brand/${file}`))
  const manifest = () => {
    const { semantic } = JSON.parse(readFileSync(resolveFromApp('@meddleware/design-tokens/tokens.json'), 'utf8'))
    return JSON.stringify(
      {
        name,
        short_name: name,
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
        theme_color: semantic.dark.bg,
        background_color: semantic.dark.bg,
        display: 'browser',
      },
      null,
      2,
    )
  }
  return {
    name: 'meddleware:brand-icons',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = (req.url ?? '').split('?')[0]?.slice(1) ?? ''
        if (file in BRAND_FILES) {
          res.setHeader('content-type', BRAND_FILES[/** @type {keyof typeof BRAND_FILES} */ (file)])
          res.end(read(file))
        } else if (file === 'site.webmanifest') {
          res.setHeader('content-type', 'application/manifest+json')
          res.end(manifest())
        } else next()
      })
    },
    generateBundle() {
      for (const file of Object.keys(BRAND_FILES)) this.emitFile({ type: 'asset', fileName: file, source: read(file) })
      this.emitFile({ type: 'asset', fileName: 'site.webmanifest', source: manifest() })
    },
    transformIndexHtml() {
      return [
        { tag: 'link', attrs: { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'icon', href: '/favicon.ico', sizes: '48x48' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'manifest', href: '/site.webmanifest' }, injectTo: 'head' },
      ]
    },
  }
}
