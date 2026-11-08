import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { brandIcons, meddlewareApp } from '../src/vite.js'
import { sync } from '../src/sync.js'

let root: string
const cwd = process.cwd()
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'brand-'))
  const ui = join(root, 'node_modules/@meddleware/ui')
  mkdirSync(join(ui, 'dist/brand'), { recursive: true })
  writeFileSync(join(ui, 'package.json'), JSON.stringify({ name: '@meddleware/ui', version: '1.0.0', exports: { './brand/*': './dist/brand/*' } }))
  for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) writeFileSync(join(ui, 'dist/brand', f), `file:${f}`)
  const tokens = join(root, 'node_modules/@meddleware/design-tokens')
  mkdirSync(tokens, { recursive: true })
  writeFileSync(join(tokens, 'package.json'), JSON.stringify({ name: '@meddleware/design-tokens', version: '1.0.0', exports: { './tokens.json': './tokens.json' } }))
  writeFileSync(join(tokens, 'tokens.json'), JSON.stringify({ semantic: { light: { bg: '#fff' }, dark: { bg: '#111' } } }))
  process.chdir(root)
})
afterEach(() => {
  process.chdir(cwd)
  rmSync(root, { recursive: true, force: true })
})

const plugin = (name?: string) => brandIcons({ name }) as unknown as {
  generateBundle: (this: { emitFile: (f: { fileName: string; source: unknown }) => void }) => void
  transformIndexHtml: () => { tag: string; attrs: Record<string, string> }[]
  configureServer: (s: { middlewares: { use: (fn: (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b: unknown) => void }, next: () => void) => void) => void } }) => void
}

describe('brandIcons', () => {
  it('emits the icon files and a manifest at the site root', () => {
    const emitted: { fileName: string; source: unknown }[] = []
    plugin('Treasury').generateBundle.call({ emitFile: (f) => emitted.push(f) })
    expect(emitted.map((e) => e.fileName).sort()).toEqual(['apple-touch-icon.png', 'favicon.ico', 'favicon.svg', 'icon-192.png', 'icon-512.png', 'site.webmanifest'])
    const manifest = JSON.parse(String(emitted.find((e) => e.fileName === 'site.webmanifest')!.source))
    expect(manifest).toMatchObject({ name: 'Treasury', short_name: 'Treasury', theme_color: '#111', display: 'browser' })
    expect(manifest.icons.map((i: { src: string }) => i.src)).toContain('/icon-512.png')
  })

  it('links the set from the page head', () => {
    const tags = plugin().transformIndexHtml()
    expect(tags.map((t) => `${t.attrs.rel}:${t.attrs.href}`)).toEqual(['icon:/favicon.svg', 'icon:/favicon.ico', 'apple-touch-icon:/apple-touch-icon.png', 'manifest:/site.webmanifest'])
  })

  it('serves the files in development and leaves other requests alone', () => {
    const use = vi.fn()
    plugin().configureServer({ middlewares: { use } })
    const fn = use.mock.calls[0]![0] as (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b: unknown) => void }, next: () => void) => void
    const res = { setHeader: vi.fn(), end: vi.fn() }
    fn({ url: '/favicon.svg?x=1' }, res, vi.fn())
    expect(res.setHeader).toHaveBeenCalledWith('content-type', 'image/svg+xml')
    expect(String(res.end.mock.calls[0]![0])).toBe('file:favicon.svg')
    const next = vi.fn()
    fn({ url: '/index.html' }, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('is part of meddlewareApp', () => {
    const cfg = meddlewareApp({ plugins: [] })({ mode: 'production', command: 'build' }) as { plugins: { name: string }[] }
    expect(cfg.plugins.map((p) => p.name)).toContain('meddleware:brand-icons')
  })
})

describe('mw-sync and stray icons', () => {
  it('fails an app that carries its own favicon, and --write removes it', () => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'x', meddleware: { kind: 'app' } }))
    mkdirSync(join(root, 'public'))
    writeFileSync(join(root, 'public/favicon.svg'), '<svg/>')
    expect(sync(root).find((r) => r.file === 'public/favicon.svg')).toMatchObject({ ok: false })
    expect(sync(root, { write: true }).find((r) => r.file === 'public/favicon.svg')).toMatchObject({ ok: true })
    expect(sync(root).some((r) => r.file === 'public/favicon.svg')).toBe(false)
  })
})
