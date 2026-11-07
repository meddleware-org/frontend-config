import { describe, expect, it } from 'vitest'
import { meddlewareApp } from '../src/vite.js'
import { inlineMeddleware, vueTestConfig } from '../src/vitest.js'

describe('meddlewareApp', () => {
  const env = { mode: 'production', command: 'build' } as const
  it('adds the theme plugin after the app plugins, a browserslist target and the wallet-adapter exclusion', () => {
    const cfg = meddlewareApp({ plugins: [{ name: 'a' }] })(env) as any
    expect(cfg.plugins.map((p: { name: string }) => p.name)).toEqual(['a', 'meddleware:theme-init'])
    expect(cfg.optimizeDeps.exclude).toEqual(['@meddleware/wallet-adapter'])
    expect(cfg.build.target).toBeDefined()
  })
  it('merges app build options, and leaves optimizeDeps alone for an app without the wallet', () => {
    const cfg = meddlewareApp({ plugins: [], wallet: false, config: { base: '/', build: { rollupOptions: { input: { main: 'index.html' } } } } })(env) as any
    expect(cfg.base).toBe('/')
    expect(cfg.build.rollupOptions.input).toEqual({ main: 'index.html' })
    expect(cfg.build.target).toBeDefined()
    expect(cfg.optimizeDeps).toBeUndefined()
  })
  it('refuses VITE_E2E outside the e2e mode', () => {
    process.env.VITE_E2E = '1'
    try {
      expect(() => meddlewareApp({ plugins: [] })(env)).toThrow(/VITE_E2E/)
      expect(() => meddlewareApp({ plugins: [] })({ ...env, mode: 'e2e' })).not.toThrow()
    } finally {
      delete process.env.VITE_E2E
    }
  })
})

describe('vueTestConfig', () => {
  it('gives jsdom, one Vue and the inlined UI packages', () => {
    const cfg = vueTestConfig({ plugins: [] }) as any
    expect(cfg.test.environment).toBe('jsdom')
    expect(cfg.test.include).toEqual(['tests/**/*.test.ts'])
    expect(cfg.resolve.dedupe).toContain('vue')
    expect(cfg.test.server.deps.inline).toEqual(inlineMeddleware)
  })
  it('lets the repository override and extend', () => {
    const cfg = vueTestConfig({ plugins: [], test: { include: ['x/**'], server: { deps: { inline: [/foo/] } } } }) as any
    expect(cfg.test.include).toEqual(['x/**'])
    expect(cfg.test.server.deps.inline).toEqual([...inlineMeddleware, /foo/])
  })
})
