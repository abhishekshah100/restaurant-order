import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // Explicit version: eslint-plugin-react's auto-detect uses an API removed in ESLint 10.
    settings: { react: { version: '19.3' } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    // No hard-coded copy in components: every user-visible or screen-reader string comes from
    // the content API (public/api/content/*.json via useContent / getContent).
    files: ['src/**/*.tsx'],
    ignores: ['src/app/styleguide/**'], // internal design board with demo content
    rules: {
      'react/jsx-no-literals': [
        'error',
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: [
            '·',
            '×',
            '—',
            '–',
            '…',
            '₹',
            '/',
            '+',
            '−',
            '-',
            '%',
            ':',
            '(',
            ')',
            '|',
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSXAttribute[name.name=/^(aria-label|aria-description|title|alt|placeholder|label|hint|error|backLabel|description)$/] > Literal[value=/\\S/]',
          message: 'Text props must come from content (useContent / getContent), not a literal.',
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
