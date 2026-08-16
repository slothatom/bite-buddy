import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist', 'src/data/generated', 'node_modules'] },

  // Application code.
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Unused code is usually a leftover from a refactor, but underscore-
      // prefixed names are an explicit "yes, I know" for unused parameters.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // `any` erases exactly the guarantees this codebase leans on — that a
      // Component is either a food or a recipe, and nothing else.
      '@typescript-eslint/no-explicit-any': 'error',

      // Nested interactive elements are invalid HTML and browsers reparent
      // them, silently dropping the inner element's click handler. That bug
      // shipped twice here, so it is worth catching mechanically.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXElement[openingElement.name.name="button"] JSXElement[openingElement.name.name="button"]',
          message: 'A <button> inside a <button> is invalid HTML; browsers reparent it and the inner click handler never fires. Make them siblings.',
        },
        {
          selector: 'JSXElement[openingElement.name.name="button"] JSXElement[openingElement.name.name="a"]',
          message: 'An <a> inside a <button> is invalid HTML. Make them siblings.',
        },
      ],
    },
  },

  // Build scripts run in Node and legitimately write to the console.
  {
    files: ['scripts/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
)
