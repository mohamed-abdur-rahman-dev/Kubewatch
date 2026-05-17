/**
 * .eslintrc.js — ESLint configuration for the dashboard app.
 *
 * Rules chosen to catch common React mistakes without being pedantic:
 *   - no-unused-vars: warn (not error) because dead imports accumulate during dev
 *   - no-console: allow console.error (hook error logging), block console.log in production paths
 *   - react-hooks/rules-of-hooks: would be here if eslint-plugin-react-hooks is added
 */
module.exports = {
  env: {
    browser:  true,
    es2020:   true,
    node:     true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion:  2020,
    sourceType:   'module',
    ecmaFeatures: { jsx: true },
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console':     ['warn', { allow: ['error', 'warn'] }],
  },
};
