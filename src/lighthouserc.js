// @ts-check
// Lighthouse CI config (free, filesystem upload): accessibility must score 100; best practices and SEO are floors; performance and
// bundle weight are warnings with budgets. Lighthouse CI loads its config with `require`, so a repo's file is a `lighthouserc.cjs`
// (Node loads the ES module through `require`); a `lighthouserc.js` in an ES-module package is silently ignored (defaults run):
//   const { lighthouseConfig } = require('@meddleware/frontend-config/lighthouserc')
//   module.exports = lighthouseConfig({ port: 4181, paths: ['/', '/blockchain'] })

/**
 * The Lighthouse CI configuration for a built app or site.
 * @param {object} options - what to serve and audit
 * @param {number} options.port Port `vite preview` (or `vitepress preview`) serves on.
 * @param {string[]} [options.paths] Routes to audit.
 * @param {string} [options.startServerCommand] Command that serves the built site (default `npx vite preview`).
 * @param {number} [options.maxScriptKb] Warn above this much JavaScript on a route.
 * @param {number} [options.maxStylesheetKb] Warn above this much CSS on a route.
 * @returns the object a `lighthouserc.cjs` exports (`{ ci: { collect, assert, upload } }`)
 */
export function lighthouseConfig({ port, paths = ['/'], startServerCommand, maxScriptKb = 300, maxStylesheetKb = 60 }) {
  return {
    ci: {
      collect: {
        url: paths.map((p) => `http://localhost:${port}${p}`),
        startServerCommand: startServerCommand ?? `npx vite preview --port ${port} --strictPort`,
        // `vite preview` prints a "Local:" line when it is ready; Lighthouse waits for it before auditing.
        startServerReadyPattern: 'Local',
        // One run: the gates are scores that do not wobble (accessibility, best practices); performance only warns.
        numberOfRuns: 1,
        // `--no-sandbox`: the CI container runs Chrome as root, where its sandbox cannot start.
        settings: { chromeFlags: '--no-sandbox', onlyCategories: ['accessibility', 'best-practices', 'seo', 'performance'] },
      },
      assert: {
        assertions: {
          // Accessibility is the hard gate: a perfect score, because axe and the keyboard suite already find the rest.
          'categories:accessibility': ['error', { minScore: 1 }],
          'categories:best-practices': ['error', { minScore: 0.95 }],
          // Search and speed are floors that warn, not gates: they depend on the runner's load and on what a page is for.
          'categories:seo': ['warn', { minScore: 0.9 }],
          'categories:performance': ['warn', { minScore: 0.9 }],
          'resource-summary:script:size': ['warn', { maxNumericValue: maxScriptKb * 1024 }],
          'resource-summary:stylesheet:size': ['warn', { maxNumericValue: maxStylesheetKb * 1024 }],
        },
      },
      upload: { target: 'filesystem', outputDir: 'test-results/lighthouse' },
    },
  }
}
