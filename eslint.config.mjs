import js from '@eslint/js';
import globals from 'globals';

export default [
  {ignores: ['node_modules/', '.local/']},
  js.configs.recommended,
  {
    // Page code: esbuild bundles these modules into one inline script that runs in the browser.
    files: ['src/app/**/*.mjs'],
    languageOptions: {globals: globals.browser}
  },
  {
    // Runs in <head> before the page paints, as a classic script.
    files: ['src/initial-theme.js'],
    languageOptions: {sourceType: 'script', globals: globals.browser}
  },
  {
    // The questions and tool settings compiler run in the browser and in Node, so they use neither environment.
    files: ['src/core/**/*.mjs'],
    languageOptions: {globals: {}}
  },
  {
    files: ['scripts/**/*.mjs', 'test/**/*.mjs', '*.config.mjs'],
    languageOptions: {globals: globals.node}
  },
  {
    // Playwright tests run in Node and pass callbacks that run in the page.
    files: ['e2e/**/*.mjs'],
    languageOptions: {globals: {...globals.node, ...globals.browser}}
  }
];
