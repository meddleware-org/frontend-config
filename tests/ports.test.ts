import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Every repository's preview port (Playwright and Lighthouse CI share it) is listed once in ports.json; two repos on one port made a stale
// server answer another repo's whole Playwright run (FU-0075). A repository adds its port here when it gets a Playwright config.
const ports: Record<string, number> = JSON.parse(readFileSync(new URL('../ports.json', import.meta.url), 'utf8'))

describe('preview port registry', () => {
  it('gives every repository its own port', () => {
    const byPort = new Map<number, string[]>()
    for (const [repo, port] of Object.entries(ports)) byPort.set(port, [...(byPort.get(port) ?? []), repo])
    const clashes = [...byPort].filter(([, repos]) => repos.length > 1)
    expect(clashes).toEqual([])
  })
  it('keeps the ports in the 4000 to 4999 range, away from the dev servers', () => {
    for (const port of Object.values(ports)) expect(port).toBeGreaterThanOrEqual(4100)
    for (const port of Object.values(ports)) expect(port).toBeLessThan(5000)
  })
})
