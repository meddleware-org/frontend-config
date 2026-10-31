// @ts-check
// Flat ESLint config for a Vue 3 + TypeScript app or library: Vue and TypeScript recommended rules, WAI-ARIA template linting
// (eslint-plugin-vuejs-accessibility), browser-API compatibility against the shared browserslist (eslint-plugin-compat), and
// optionally the Sui chain-access boundary (@meddleware/eslint-config). A repo's eslint.config.ts becomes
//   import { vueApp } from '@meddleware/frontend-config/eslint'
//   export default vueApp({ name: 'treasury-ui', sui: true })
import { suiBoundary } from '@meddleware/eslint-config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import { globalIgnores } from 'eslint/config'
import pluginCompat from 'eslint-plugin-compat'
import pluginVue from 'eslint-plugin-vue'
import pluginA11y from 'eslint-plugin-vuejs-accessibility'

/** `@meddleware/ui` components that render a native control, so the label rules see through them. */
export const CONTROL_COMPONENTS = Object.freeze(['UiSelect', 'UiInput', 'UiTextarea'])
/** `@meddleware/ui` components that render the `<label for>` for the control in their default slot. */
export const LABEL_COMPONENTS = Object.freeze(['UiFormField'])

/**
 * One flat-config object. Declared structurally (rather than as ESLint's own type) because ESLint's type refers to internal
 * packages that TypeScript cannot name in a declaration file; ESLint accepts this shape.
 * @typedef {{ name?: string, files?: (string | string[])[], ignores?: string[], rules?: Record<string, unknown>, [key: string]: unknown }} FlatConfig
 */

const TESTS = ['**/*.{test,spec}.{ts,tsx}', 'tests/**', 'e2e/**']

/**
 * @param {object} options
 * @param {string} options.name Prefix for the config object names (usually the repo name).
 * @param {boolean} [options.sui] Append the Sui chain-access boundary (apps and tool libraries; not ui, tokens or sites).
 * @param {string[]} [options.ignores] Extra global ignores (for example `docs/api/**`).
 * @param {string[]} [options.controlComponents] Extra components that render a native form control.
 * @param {string[]} [options.labelComponents] Extra components that render a label.
 * @param {FlatConfig[]} [options.extra] Extra config objects, placed before the boundary.
 * @returns {FlatConfig[]}
 */
export function vueApp({ name, sui = false, ignores = [], controlComponents = [], labelComponents = [], extra = [] }) {
  return /** @type {FlatConfig[]} */ (defineConfigWithVueTs(
    { name: `${name}/files-to-lint`, files: ['**/*.{vue,ts,mts,tsx}'] },

    globalIgnores(['**/dist/**', '**/gallery-dist/**', '**/coverage/**', '**/*.d.ts', '**/test-results/**', '**/playwright-report/**', '**/.lighthouseci/**', '**/lighthouserc.cjs', ...ignores]),

    ...pluginVue.configs['flat/essential'],
    ...pluginA11y.configs['flat/recommended'],
    vueTsConfigs.recommended,

    {
      name: `${name}/a11y-overrides`,
      rules: {
        // <ol role="list"> is an intentional workaround: Safari/VoiceOver drops list semantics when list-style is
        // removed, so the explicit role stays.
        'vuejs-accessibility/no-redundant-roles': 'off',
        // Accept both valid label-association patterns: a label wrapping its control (nesting) or a label[for] pointing at a
        // control[id]. UiSelect and UiInput render a native control, so a label nesting one is labelling a control.
        'vuejs-accessibility/label-has-for': [
          'error',
          { required: { some: ['nesting', 'id'] }, controlComponents: [...CONTROL_COMPONENTS, ...controlComponents] },
        ],
        // UiFormField renders the <label for> for the control in its default slot.
        'vuejs-accessibility/form-control-has-label': [
          'error',
          { labelComponents: [...LABEL_COMPONENTS, ...labelComponents] },
        ],
        // Underscore-prefixed args and variables are an intentional "unused" marker.
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      },
    },

    {
      // Browser-API compatibility against the shared browserslist. Source only: tests and e2e run in Node or in the test browser.
      name: `${name}/compat`,
      files: ['src/**/*.{vue,ts,mts,tsx,js}'],
      ignores: TESTS,
      ...pluginCompat.configs['flat/recommended'],
    },

    {
      // Tests use deliberately loose typing for mocks and stubs.
      name: `${name}/test-overrides`,
      files: TESTS,
      rules: { '@typescript-eslint/no-explicit-any': 'off' },
    },

    ...(/** @type {any[]} */ (extra)),

    ...(sui ? suiBoundary() : []),
  ))
}
