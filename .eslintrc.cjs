/**
 * Centralized ESLint configuration shared across the pnpm workspace.
 * Type-aware rules keep the template aligned with strict TypeScript defaults.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.base.json'],
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  env: {
    es2023: true,
    node: true,
  },
  ignorePatterns: [
    'node_modules',
    'dist',
    '*.config.js',
    '*.config.ts',
    'apps/**/*',
    'servers/**/*',
    'types/**/*',
    'config/**/*',
  ],
  plugins: ['@typescript-eslint', 'import', 'promise'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:promise/recommended',
    'prettier',
  ],
  settings: {
    'import/resolver': {
      typescript: true,
    },
  },
  rules: {
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-default-export': 'off',
    'promise/always-return': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
};
