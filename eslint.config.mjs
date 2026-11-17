import gts from 'gts';
import tseslint from 'typescript-eslint';
import perfectionist from 'eslint-plugin-perfectionist';
import unusedImports from 'eslint-plugin-unused-imports';

const noComments = {
  meta: {type: 'problem', schema: [], messages: {banned: 'Comments are not allowed.'}},
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          context.report({loc: comment.loc, messageId: 'banned'});
        }
      },
    };
  },
};

export default tseslint.config(
  {ignores: ['**/node_modules/**', '**/dist/**', 'apps/api/drizzle/**']},
  ...gts,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: null,
        projectService: {allowDefaultProject: ['apps/web/vite.config.ts']},
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {jsx: true},
      },
    },
  },
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    plugins: {local: {rules: {'no-comments': noComments}}, 'unused-imports': unusedImports, perfectionist},
    rules: {
      'local/no-comments': 'error',
      'no-unreachable': 'error',
      'no-empty': ['error', {allowEmptyCatch: true}],
      eqeqeq: ['error', 'always', {null: 'ignore'}],
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['error', {args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none'}],
      'perfectionist/sort-imports': ['error', {type: 'line-length', order: 'asc', groups: [], newlinesBetween: 0, partitionByNewLine: false}],
    },
  },
);
