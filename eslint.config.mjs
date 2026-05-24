import nextConfig from 'eslint-config-next';

export default [
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'public/**', 'scripts/**'],
  },
  ...nextConfig,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'prefer-const': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
