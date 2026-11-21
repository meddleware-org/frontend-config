// Stylelint configuration of every Meddleware app: the shared one (token-only colours and z-index, accessibility rules, browser support
// against the shared browserslist), used as it is. A repository that needs a different severity or an override passes options to
// `stylelintConfig()` here, and says why in a comment. A template: `mw-sync` keeps this file identical in every `"kind": "app"` repository.
import { stylelintConfig } from '@meddleware/frontend-config/stylelint'

export default stylelintConfig()
