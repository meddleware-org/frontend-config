// @ts-check
// Autoprefixer over the CSS a build ships, targeting the repo's browserslist (which should extend
// `@meddleware/frontend-config/browserslist-config`). A repo's postcss.config.js becomes
//   export { default } from '@meddleware/frontend-config/postcss'
import autoprefixer from 'autoprefixer'

// The only plugin: it reads the consumer's browserslist (which extends the shared support promise), so what gets prefixed follows from
// that one list. Nothing else transforms the CSS, because the build ships what the tokens and components wrote.
export default { plugins: [autoprefixer()] }
