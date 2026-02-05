const prettier = require('eslint-config-prettier');

module.exports = [
  {
    ignores: ['dist', 'node_modules'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
    },
    rules: {},
  },
  prettier,
];
