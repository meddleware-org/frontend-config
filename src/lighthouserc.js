// @ts-check
// Lighthouse CI config (free, filesystem upload): accessibility must score 100; best practices and SEO are floors; performance and
// bundle weight are warnings with budgets. Lighthouse CI loads its config with `require`, so a repo's file is a `lighthouserc.cjs`
// (Node loads the ES module through `require`); a `lighthouserc.js` in an ES-module package is silently ignored (defaults run):
//   const { lighthouseConfig } = require('@meddleware/frontend-config/lighthouserc')
//   module.exports = lighthouseConfig({ port: 4181, paths: ['/', '/blockchain'] })

/**
 * @param {object} options
 * @param {number} options.port Port `vite preview` (or `vitepress preview`) serves on.
 * @param {string[]} [options.paths] Routes to audit.
 * @param {string} [options.startServerCommand] Command that serves the built site (default `npx vite preview`).
 * @param {number} [options.maxScriptKb] Warn above this much JavaScript on a route.
 * @param {number} [options.maxStylesheetKb] Warn above this much CSS on a route.
 */
export function lighthouseConfig({ port, paths = ['/'], startServerCommand, maxScriptKb = 300, maxStylesheetKb = 60 }) {
  return {
    ci: {
      collect: {
        url: paths.map((p) => `http://localhost:${port}${p}`),
        startServerCommand: startServerCommand ?? `npx vite preview --port ${port} --strictPort`,
        startServerReadyPattern: 'Local',
        numberOfRuns: 1,
        settings: { chromeFlags: '--no-sandbox', onlyCategories: ['accessibility', 'best-practices', 'seo', 'performance'] },
      },
      assert: {
        assertions: {
          'categories:accessibility': ['error', { minScore: 1 }],
          'categories:best-practices': ['error', { minScore: 0.95 }],
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
