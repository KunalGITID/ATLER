import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // The UI code predates linting; keep the signal on real bugs.
      'no-unused-vars': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['src/sw.template.js'],
    languageOptions: { globals: { ...globals.serviceworker, __ASSETS__: 'readonly' } },
  },
  {
    files: ['*.config.js', 'test/**'],
    languageOptions: { globals: { ...globals.node } },
  },
];
