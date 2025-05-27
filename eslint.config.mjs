import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import { createRequire } from 'module';

const requireExtension = createRequire(import.meta.url)('eslint-plugin-require-extensions');

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  importPlugin.flatConfigs.typescript,
  importPlugin.flatConfigs.recommended,
  {
    plugins: {
      'require-extensions': {
        meta: {
          name: 'require-extensions',
          version: '1.0.0',
          fixable: true,
        },
        rules: {
          'require-extensions': requireExtension.rules['require-extensions'],
          'require-index': requireExtension.rules['require-index'],
        },
      },
    },
    files: ['packages/scrypt-ts-btc/**/*.ts'],
    rules: requireExtension.configs.recommended.rules,
  },

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'import/no-unresolved': 'off',
      'import/no-cycle': [2, { maxDepth: 1 }],
      // disable import/named to avoid import {interfaceA} from 'moduleA' issues
      // see https://github.com/typescript-eslint/typescript-eslint/issues/154#issuecomment-547567531
      // "import/named": "off",
    },
    settings: {
      'import/resolver': {
        // You will also need to install and configure the TypeScript resolver
        // See also https://github.com/import-js/eslint-import-resolver-typescript#configuration
        typescript: true,
        node: true,
      },
      'import/ignore': ['node_modules'],
    },
  },
  {
    files: ['**/*.spec.ts', '**/test/**/*.ts'],
    rules: {
      // disable some rules for test files, as they are often used to test edge cases or they are pre-written test cases that do not need to be linted/changed
      '@typescript-eslint/no-unused-expressions': 'off',
      'import/no-named-as-default-member': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'prefer-rest-params': 'off',
    },
  },
  {
    files: ['**/opcat/**/*.js'],
    rules: {
      // disable some rules for test files, as they are often used to test edge cases or they are pre-written test cases that do not need to be linted/changed
      '@typescript-eslint/no-unused-expressions': 'off',
      'import/no-named-as-default-member': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      'no-constant-condition': 'off',
      'no-case-declarations': 'off',
      'prefer-rest-params': 'off',
    },
  },
  // Global ignores
  // If a config block only contains an `ignores` key, then the globs are
  // ignored globally
  {
    ignores: ['**/node_modules/*', '**/test/**/*', '**/dist/**/*'],
  },
];
