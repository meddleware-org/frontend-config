// The workspace browser support promise, as a browserslist shared config. A repo uses it with
//   "browserslist": ["extends @meddleware/frontend-config/browserslist-config"]
// (browserslist resolves `@scope/pkg/browserslist-config`). It drives autoprefixer, eslint-plugin-compat,
// stylelint-no-unsupported-browser-features and the Vite build target, so one list decides all four.
//
// Deliberately NOT "last 2 versions": that also selects Opera Mini, KaiOS, Baidu and QQ. Every app here is a Vue SPA and the
// wallet apps need wallet-standard browser extensions, so none of those engines can run them; fallbacks for them would
// cost CSS and complexity for no working user. Newer-than-the-oldest-browser features still need @supports / progressive
// enhancement, which the compat linters enforce.
module.exports = [
  'last 2 Chrome versions',
  'last 2 ChromeAndroid versions',
  'last 2 Edge versions',
  'last 2 Firefox versions',
  'last 2 FirefoxAndroid versions',
  'last 2 Safari versions',
  'last 2 iOS versions',
  'last 2 Samsung versions',
  'Firefox ESR',
  'not dead',
]
