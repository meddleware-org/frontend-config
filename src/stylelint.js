// @ts-check
// Stylelint over CSS and the <style> blocks of Vue SFCs: the standard config tuned for a token-driven codebase, no hex colours,
// token-only values for colour and layering, accessibility rules (@double-great/stylelint-a11y) and browser-support linting
// against the shared browserslist (stylelint-no-unsupported-browser-features). A repo's stylelint.config.js becomes
//   import { stylelintConfig } from '@meddleware/frontend-config/stylelint'
//   export default stylelintConfig()
import { fileURLToPath } from 'node:url'
import postcssHtml from 'postcss-html'

// Resolve plugins and the base config from THIS package, not the consumer's directory, so they are found however the consumer's
// package manager lays out node_modules (stylelint otherwise resolves names relative to the consumer's config file).
/** @param {string} name */
const here = (name) => fileURLToPath(import.meta.resolve(name))

/** Colour-bearing properties: a literal colour here bypasses the design tokens (and so the seasons). */
const COLOUR_PROPERTIES = ['/color$/', 'fill', 'stroke', 'outline-color', 'text-decoration-color', 'caret-color', 'accent-color']

/** Values that carry no colour of their own, so they are allowed where a token is expected. */
const NEUTRAL_VALUES = ['transparent', 'inherit', 'currentColor', 'currentcolor', 'none', 'initial', 'unset', 'revert', 'auto', '0']

/**
 * @param {object} [options]
 * @param {'error' | 'warning' | false} [options.tokens] Severity of the token-only rule. Default `error`; a repo with
 *   literals still to fix starts at `warning` and moves to `error` in the same release as the fixes.
 * @param {'error' | 'warning'} [options.compat] Severity of unsupported-browser-feature findings. Default `error`.
 * @param {string[]} [options.browsers] Browsers to check against. Default: the repo's browserslist (the shared support promise).
 * @param {Record<string, unknown>} [options.rules] Rule overrides.
 */
export function stylelintConfig({ tokens = 'error', compat = 'error', browsers, rules = {} } = {}) {
  return {
    extends: [here('stylelint-config-standard')],
    plugins: [
      here('stylelint-no-unsupported-browser-features'),
      here('@double-great/stylelint-a11y'),
      here('stylelint-declaration-strict-value'),
    ],
    overrides: [{ files: ['**/*.vue', '**/*.html'], customSyntax: postcssHtml }],
    rules: {
      // The design system leans heavily on custom properties and deliberate ordering; these standard rules are too noisy for
      // a token-driven codebase.
      'custom-property-empty-line-before': null,
      'declaration-empty-line-before': null,
      'comment-empty-line-before': null,
      'rule-empty-line-before': null,
      'at-rule-empty-line-before': null,
      'no-descending-specificity': null,
      // BEM-style class names (block__element--modifier) are intentional.
      'selector-class-pattern': null,
      // Some presentational SFCs use compact single-line multi-declaration rules.
      'declaration-block-single-line-max-declarations': null,
      // Preserve camelCase CSS keyword values (for example text-rendering: optimizeLegibility).
      'value-keyword-case': null,
      // Vue SFC scoped-style pseudo-classes.
      'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['deep', 'slotted', 'global'] }],
      // Private panel vars use a leading-underscore convention (--_bg, --_text).
      'custom-property-pattern': null,
      // Vendor-prefixed properties are emitted by autoprefixer at build time; the hand-written -webkit-/-moz-
      // font-smoothing pair is intentional.
      'property-no-vendor-prefix': null,
      'value-no-vendor-prefix': null,

      // Colours come from the design tokens, never a literal.
      'color-no-hex': true,

      ...(tokens
        ? {
            'scale-unlimited/declaration-strict-value': [
              [...COLOUR_PROPERTIES, 'z-index'],
              { ignoreValues: NEUTRAL_VALUES, disableFix: true, severity: tokens },
            ],
          }
        : {}),

      // Browser support against the shared browserslist. Partial support is accepted: the feature degrades, it does not break.
      // Three more degrade harmlessly and are ignored on purpose: `resize` (touch Safari has no resizable fields), non-standard
      // `cursor` values (a pointer-device nicety), and the extended system font keywords (every use has a fallback stack).
      'plugin/no-unsupported-browser-features': [
        true,
        {
          severity: compat,
          ignorePartialSupport: true,
          ignore: ['css-resize', 'css3-cursors', 'extended-system-fonts'],
          ...(browsers ? { browsers } : {}),
        },
      ],

      // Accessibility.
      // (`a11y/media-prefers-reduced-motion` is off: @meddleware/ui's reset applies one global reduced-motion rule to every app,
      // so a per-rule media query is redundant noise.)
      'a11y/media-prefers-reduced-motion': null,
      'a11y/no-outline-none': true,
      // (`a11y/selector-pseudo-class-focus` is off: it asks for a `:focus` twin of every `:hover`, but the reset gives every focusable
      // element a visible `:focus-visible` ring and `a11y/no-outline-none` below stops anything removing it, so a hover-only cosmetic
      // needs no twin.)
      'a11y/selector-pseudo-class-focus': null,
      'a11y/content-property-no-static-value': true,
      'a11y/font-size-is-readable': true,
      'a11y/no-obsolete-attribute': true,
      'a11y/no-obsolete-element': true,
      'a11y/no-text-align-justify': true,

      ...rules,
    },
  }
}

export default stylelintConfig()
