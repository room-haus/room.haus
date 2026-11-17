import globals from 'globals';

export default [
  {ignores: ['dist/**', 'release/**', 'test-results/**', 'playwright-report/**', 'src/audio/worklets/**']},
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      parserOptions: {ecmaFeatures: {jsx: true}},
      globals: {...globals.browser},
    },
    linterOptions: {reportUnusedDisableDirectives: 'off'},
    rules: {
      'constructor-super': 'error',
      'no-async-promise-executor': 'error',
      'no-dupe-keys': 'error',
      'no-func-assign': 'error',
      'no-unreachable': 'error',
      'no-undef': 'error',
      'valid-typeof': 'error',
    },
  },
  {
    files: ['src/babylon/skyboxes/**', 'src/babylon/scenes/index.js'],
    languageOptions: {globals: {require: 'readonly'}},
  },
  {
    files: ['scripts/**', 'test/**', 'e2e/**', '*.config.*'],
    languageOptions: {globals: {...globals.browser, ...globals.node}},
  },
];
