import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default [
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'public/**'],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'prefer-const': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
