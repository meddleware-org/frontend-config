// @ts-check
// Autoprefixer over the CSS a build ships, targeting the repo's browserslist (which should extend
// `@meddleware/frontend-config/browserslist-config`). A repo's postcss.config.js becomes
//   export { default } from '@meddleware/frontend-config/postcss'
import autoprefixer from 'autoprefixer'

export default { plugins: [autoprefixer()] }
