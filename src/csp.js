// @ts-check
// The Content-Security-Policy of a MeddleWare static site, built from a named profile. Every frontend image serves one (the Dockerfile's `ARG CSP`,
// handed to static-server): twelve hand-copied strings drifted in small ways, so the profiles live here and `mw-sync` checks each Dockerfile against its
// profile. A policy has no 'unsafe-inline' for scripts (`mw-check-csp-inline` fails the build on an inline script that is not allowed by hash).

/**
 * @typedef {object} CspOptions
 * @property {boolean} [wasm] allow WebAssembly (`'wasm-unsafe-eval'`): the Walrus and Move-bytecode clients
 * @property {boolean} [chain] chain-facing app: https images, https connections (RPC, relay, aggregator and key-server hosts are partly configured), blob workers
 * @property {boolean} [worker] allow `worker-src 'self' blob:` without the rest of `chain` (VitePress sites)
 * @property {boolean} [strict] `base-uri` and `form-action` are `'none'` (a page with no forms and no `<base>`)
 * @property {'self' | 'none'} [frameAncestors] who may frame the page (default `'self'`)
 * @property {string[]} [scriptHashes] `'sha256-…'` sources for the inline scripts a static-site generator emits
 */

/** @type {Record<string, CspOptions>} */
export const PROFILES = {
  /** Same-origin only: the landing page. */
  static: {},
  /** Same-origin only, no forms and no `<base>`: the status page and the public roadmap. */
  'static-strict': { strict: true },
  /** An operator console: same-origin only and never framed. */
  console: { frameAncestors: 'none' },
  /** A chain-facing tool: https connections and images, blob workers. */
  chain: { chain: true },
  /** A chain-facing tool that runs WebAssembly (Walrus, Move bytecode). */
  'chain-wasm': { chain: true, wasm: true },
  /** A VitePress site: same-origin connections, https images, blob workers, inline scripts allowed by hash (the hashes are kept from the current policy). */
  docs: { worker: true },
}

/**
 * @param {CspOptions} options
 * @returns {string}
 */
export function buildCsp(options = {}) {
  const { wasm = false, chain = false, worker = false, strict = false, frameAncestors = 'self', scriptHashes = [] } = options
  const script = ["'self'", ...(wasm ? ["'wasm-unsafe-eval'"] : []), ...scriptHashes.map((h) => `'${h.replace(/^'|'$/g, '')}'`)]
  const richImages = chain || worker
  const directives = [
    ["default-src", "'self'"],
    ['script-src', script.join(' ')],
    ['style-src', "'self' 'unsafe-inline'"],
    ['img-src', richImages ? "'self' data: blob: https:" : "'self' data:"],
    ['font-src', "'self' data:"],
    ['connect-src', chain ? "'self' https:" : "'self'"],
    ...(chain || worker ? [['worker-src', "'self' blob:"]] : []),
    ['object-src', "'none'"],
    ['base-uri', strict ? "'none'" : "'self'"],
    ['form-action', strict ? "'none'" : "'self'"],
    ['frame-ancestors', `'${frameAncestors}'`],
  ]
  return [...directives.map(([d, v]) => `${d} ${v}`), 'upgrade-insecure-requests'].join('; ')
}

/** The `'sha256-…'` hashes in a policy's script-src (kept when a profile such as `docs` is rebuilt). */
export function scriptHashesOf(/** @type {string} */ csp) {
  const src = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src ')) ?? ''
  return src.split(/\s+/).filter((t) => t.startsWith("'sha256-")).map((t) => t.slice(1, -1))
}

/** @param {string} name @param {string} [current] the policy now in the Dockerfile (its script hashes are kept) */
export function cspForProfile(name, current = '') {
  const profile = PROFILES[name]
  if (!profile) throw new Error(`unknown CSP profile "${name}" (known: ${Object.keys(PROFILES).join(', ')})`)
  return buildCsp({ ...profile, ...(name === 'docs' ? { scriptHashes: scriptHashesOf(current) } : {}) })
}
