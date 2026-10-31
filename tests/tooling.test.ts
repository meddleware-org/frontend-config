import autoprefixer from 'autoprefixer'
import postcss from 'postcss'
import { afterEach, describe, expect, it } from 'vitest'
import { lighthouseConfig } from '../src/lighthouserc.js'
import { definePlaywrightConfig } from '../src/playwright.js'
import postcssConfig from '../src/postcss.js'
import { rmSync, writeFileSync } from 'node:fs'
import { assertE2eOnlyInE2eMode, themeInit, viteTarget } from '../src/vite.js'
import { SEASONS, THEMES, VIEWPORTS, looks } from '../src/look.js'

describe('postcss', () => {
  it('prefixes what the supported browsers still need', async () => {
    const out = await postcss(postcssConfig.plugins).process('a { user-select: none; }', { from: undefined })
    expect(out.css).toContain('-webkit-user-select')
    expect(autoprefixer).toBeTypeOf('function')
  })
})

describe('vite target', () => {
  it('maps the browserslist to build targets for every engine in the support promise', () => {
    const t = viteTarget(['last 2 Chrome versions', 'last 2 Safari versions', 'last 2 Firefox versions'])
    expect(t.some((x) => x.startsWith('chrome'))).toBe(true)
    expect(t.some((x) => x.startsWith('safari'))).toBe(true)
    expect(t.some((x) => x.startsWith('firefox'))).toBe(true)
  })

  it('reads the repo configuration when given none', () => {
    expect(viteTarget().length).toBeGreaterThan(3)
  })
})

describe('definePlaywrightConfig', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })
  const clean = () => {
    delete process.env.CI
    delete process.env.SHOTS
    delete process.env.E2E_BROWSERS
  }

  it('runs Chromium only by default, and builds then previews the app', () => {
    clean()
    const c = definePlaywrightConfig({ port: 4281 })
    expect(c.projects?.map((p) => p.name)).toEqual(['chromium'])
    expect(c.use?.baseURL).toBe('http://localhost:4281')
    expect(String((c.webServer as { command: string }).command)).toBe('npm run build && npx vite preview --port 4281 --strictPort')
    expect(c.testIgnore).toEqual(['**/screens.spec.ts'])
  })

  it('runs all five browser projects in CI, or when asked', () => {
    clean()
    process.env.CI = '1'
    expect(definePlaywrightConfig({ port: 1 }).projects?.map((p) => p.name)).toEqual(['chromium', 'firefox', 'webkit', 'mobile-chrome', 'mobile-safari'])
    clean()
    process.env.E2E_BROWSERS = 'all'
    expect(definePlaywrightConfig({ port: 1 }).projects).toHaveLength(5)
    clean()
    expect(definePlaywrightConfig({ port: 1, browsers: 'all' }).projects).toHaveLength(5)
  })

  it('keeps the screenshot run on Chromium and runs screens specs only when asked, and then alone', () => {
    clean()
    process.env.CI = '1'
    process.env.SHOTS = '1'
    const c = definePlaywrightConfig({ port: 1 })
    expect(c.projects).toHaveLength(1)
    expect(c.testMatch).toBe('**/screens.spec.ts')
    expect(c.testIgnore).toBeUndefined()
  })

  it('serves a gallery or a VitePress site with the right command', () => {
    clean()
    expect((definePlaywrightConfig({ port: 2, kind: 'gallery' }).webServer as { command: string }).command).toContain('--config vite.gallery.config.ts')
    expect((definePlaywrightConfig({ port: 3, kind: 'vitepress' }).webServer as { command: string }).command).toBe('npx vitepress preview docs --port 3')
    expect((definePlaywrightConfig({ port: 4, command: 'x' }).webServer as { command: string }).command).toBe('x')
  })

  it('merges extra options over the defaults', () => {
    clean()
    expect(definePlaywrightConfig({ port: 1, extra: { retries: 3 } }).retries).toBe(3)
  })
})

describe('looks', () => {
  it('covers every theme × season on desktop and each theme on tablet and phone', () => {
    const l = looks()
    expect(l.filter((x) => x.viewport === 'desktop')).toHaveLength(THEMES.length * SEASONS.length)
    expect(l.filter((x) => x.viewport === 'phone')).toHaveLength(THEMES.length)
    expect(l.filter((x) => x.viewport === 'tablet').every((x) => x.season === 'none')).toBe(true)
    expect(Object.keys(VIEWPORTS)).toEqual(['phone', 'tablet', 'desktop'])
  })
})

describe('lighthouseConfig', () => {
  it('gates accessibility at 100 and warns on weight', () => {
    const c = lighthouseConfig({ port: 4181, paths: ['/', '/blockchain'] })
    expect(c.ci.collect.url).toEqual(['http://localhost:4181/', 'http://localhost:4181/blockchain'])
    expect(c.ci.assert.assertions['categories:accessibility']).toEqual(['error', { minScore: 1 }])
    expect(c.ci.assert.assertions['resource-summary:script:size'][0]).toBe('warn')
    expect(c.ci.upload.target).toBe('filesystem')
  })
})

describe('vitest settings', () => {
  it('lists the UI libraries that import CSS or .vue files, and nothing else (matched by file path, as Vitest does)', async () => {
    const { inlineMeddleware } = await import('../src/vitest.js')
    const match = (path: string) => inlineMeddleware.some((r) => r.test(path))
    const at = (pkg: string, file = 'dist/index.js') => `/app/node_modules/@meddleware/${pkg}/${file}`
    for (const [pkg, file] of [['ui', 'dist/components/AppHeader.css'], ['ui', undefined], ['wallet-adapter', 'src/WalletModal.vue'], ['walrus-storage-kit', 'src/index.ts'], ['design-tokens', 'src/tokens.css']] as const) {
      expect(match(at(pkg, file)), `${pkg} ${file ?? ''}`).toBe(true)
    }
    expect(match('C:\\app\\node_modules\\@meddleware\\ui\\dist\\index.js')).toBe(true)
    for (const pkg of ['web-utils', 'uix', 'access-gate-client', 'frontend-config']) expect(match(at(pkg)), pkg).toBe(false)
    expect(match('/app/node_modules/vue/dist/vue.js')).toBe(false)
  })
})

describe('installDialogShim', () => {
  it('models showModal, close and returnValue for jsdom', async () => {
    const { JSDOM } = await import('jsdom')
    const dom = new JSDOM('<dialog id="d"></dialog>')
    const g = globalThis as unknown as Record<string, unknown>
    // In a real jsdom test environment these globals ARE jsdom's; here a separate window is borrowed for the test.
    const saved = { dialog: g.HTMLDialogElement, event: g.Event }
    g.HTMLDialogElement = dom.window.HTMLDialogElement
    g.Event = dom.window.Event
    try {
      const { installDialogShim } = await import('../src/vitest.js')
      installDialogShim()
      const d = dom.window.document.getElementById('d') as HTMLDialogElement
      let closed = 0
      d.addEventListener('close', () => closed++)
      d.showModal()
      expect(d.hasAttribute('open')).toBe(true)
      d.close('ok')
      expect(d.hasAttribute('open')).toBe(false)
      expect(d.returnValue).toBe('ok')
      expect(closed).toBe(1)
      d.close() // already closed: no second event
      expect(closed).toBe(1)
    } finally {
      g.HTMLDialogElement = saved.dialog
      g.Event = saved.event
    }
  })
})

describe('themeInit', () => {
  const script = 'tests/.theme-init-fixture.js'
  const make = (options = {}) => {
    writeFileSync(script, '/* theme-init */')
    return themeInit({ scriptPath: script, colors: { light: '#f7f4f1', dark: '#120e10' }, ...options }) as unknown as {
      generateBundle(this: { emitFile: (f: unknown) => void }): void
      transformIndexHtml(): { tag: string; attrs: Record<string, string>; injectTo: string }[]
      configureServer(s: { middlewares: { use: (path: string, h: (req: unknown, res: { setHeader: (k: string, v: string) => void; end: (b: string) => void }) => void) => void } }): void
    }
  }
  afterEach(() => rmSync(script, { force: true }))

  it('loads the script first in <head>, with the default mode, and sets the colour scheme and browser chrome', () => {
    const tags = make({ default: 'dark' }).transformIndexHtml()
    expect(tags[0]).toEqual({ tag: 'script', attrs: { src: '/theme-init.js', 'data-default': 'dark' }, injectTo: 'head-prepend' })
    expect(tags.find((t) => t.attrs.name === 'color-scheme')?.attrs.content).toBe('light dark')
    expect(tags.filter((t) => t.attrs.name === 'theme-color').map((t) => [t.attrs.content, t.attrs.media])).toEqual([
      ['#f7f4f1', '(prefers-color-scheme: light)'],
      ['#120e10', '(prefers-color-scheme: dark)'],
    ])
  })

  it('defaults to the system mode', () => {
    expect(make().transformIndexHtml()[0]!.attrs['data-default']).toBe('system')
  })

  it('emits the script into the build and serves it in dev', () => {
    const plugin = make()
    const emitted: unknown[] = []
    plugin.generateBundle.call({ emitFile: (f) => emitted.push(f) })
    expect(emitted).toEqual([{ type: 'asset', fileName: 'theme-init.js', source: '/* theme-init */' }])
    let handler!: (req: unknown, res: { setHeader: (k: string, v: string) => void; end: (b: string) => void }) => void
    let mounted = ''
    plugin.configureServer({ middlewares: { use: (path, h) => ((mounted = path), (handler = h)) } })
    const sent: string[] = []
    handler({}, { setHeader: (k, v) => sent.push(`${k}: ${v}`), end: (b) => sent.push(b) })
    expect(mounted).toBe('/theme-init.js')
    expect(sent).toEqual(['content-type: text/javascript', '/* theme-init */'])
  })
})

describe('assertE2eOnlyInE2eMode', () => {
  it('lets the e2e mode set VITE_E2E, and any mode leave it unset', () => {
    expect(() => assertE2eOnlyInE2eMode('e2e', { VITE_E2E: '1' })).not.toThrow()
    expect(() => assertE2eOnlyInE2eMode('production', {})).not.toThrow()
    expect(() => assertE2eOnlyInE2eMode('development', { VITE_E2E: '' })).not.toThrow()
  })

  it('refuses VITE_E2E in a production or development build, naming the mode', () => {
    expect(() => assertE2eOnlyInE2eMode('production', { VITE_E2E: '1' })).toThrow(/is "production"/)
    expect(() => assertE2eOnlyInE2eMode('development', { VITE_E2E: '1' })).toThrow(/--mode e2e/)
  })
})
