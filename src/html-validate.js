// @ts-check
// html-validate over the Vue SFC templates (via html-validate-vue): element nesting and content models (no <p> inside <ul>, no
// button inside a label), the a11y preset (alt text, labels, landmarks, heading order) and the Vue naming style. A repo's
// .htmlvalidate.mjs becomes
//   import { htmlValidateConfig } from '@meddleware/frontend-config/html-validate'
//   export default htmlValidateConfig()
// The Vue plugin is passed as an object, so it is found from THIS package however the consumer's node_modules is laid out.
import htmlValidateVue from 'html-validate-vue'

/**
 * `@meddleware/ui` components that render a single native element, described to the validator so content models and form
 * rules see through them (keys are lowercased tag names).
 */
export const UI_ELEMENTS = Object.freeze({
  uibutton: { inherit: 'button' },
  uitoolbarbutton: { inherit: 'button' },
  uiselect: { inherit: 'select' },
  uinotice: { inherit: 'p' },
})

/**
 * @param {object} [options]
 * @param {Record<string, unknown>} [options.elements] Extra element descriptions.
 * @param {Record<string, unknown>} [options.rules] Rule overrides.
 * @returns {import('html-validate').ConfigData}
 */
export function htmlValidateConfig({ elements = {}, rules = {} } = {}) {
  return {
    plugins: [/** @type {import('html-validate').Plugin} */ (/** @type {unknown} */ (htmlValidateVue))],
    extends: ['html-validate:recommended', 'html-validate:a11y', 'html-validate-vue:recommended'],
    elements: ['html5', ({ ...UI_ELEMENTS, ...elements })],
    transform: { '^.*\\.vue$': 'html-validate-vue' },
    rules: {
      // Vue components are written in PascalCase (<UiStatusDot>, <KeepAlive>).
      'element-case': ['error', { style: ['lowercase', 'pascalcase'] }],
      'element-name': ['error', { pattern: '^(?:[a-z][a-z0-9\\-._]*-[a-z0-9\\-._]*|[A-Z][A-Za-z0-9]*)$' }],
      // role="list" on styled lists is a deliberate Safari/VoiceOver workaround: WebKit drops list semantics when list-style is
      // removed, so the explicit role must stay (matches the eslint vuejs-accessibility/no-redundant-roles override).
      'no-redundant-role': 'off',
      'prefer-native-element': ['error', { exclude: ['list'] }],
      // html-validate 11 crashes in this rule (`valueMatches` on a dynamic value) for any Vue `:href="…"` binding, and nothing here links to
      // a `tel:` URL, so the rule has nothing to check.
      'tel-non-breaking': 'off',
      ...rules,
    },
  }
}

export default htmlValidateConfig()
