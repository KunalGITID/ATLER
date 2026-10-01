import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'dist-e2e/', 'node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, __APP_RELEASE__: 'readonly' } },
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
    files: ['*.config.js', 'test/**', 'e2e/**', 'scripts/**'],
    languageOptions: { globals: { ...globals.node } },
  },
];
