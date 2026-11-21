// PostCSS configuration of every Meddleware app: the shared one (autoprefixer over the app's browserslist), re-exported so the app keeps
// no copy of it. A template: `mw-sync` keeps this file identical in every repository whose package.json says `"meddleware": { "kind": "app" }`.
export { default } from '@meddleware/frontend-config/postcss'
