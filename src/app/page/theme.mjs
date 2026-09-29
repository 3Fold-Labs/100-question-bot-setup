// Light and dark theme. src/initial-theme.js applies the saved theme before the page paints.
import {$} from '../lib/dom.mjs';
import {THEME_KEY, writeStorage} from '../store/browser-storage.mjs';

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  const button = $('theme-toggle');
  button.textContent = next === 'dark' ? 'Light' : 'Dark';
  button.setAttribute('aria-label', next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  writeStorage(THEME_KEY, next);
}

export function toggleTheme() {
  applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}
