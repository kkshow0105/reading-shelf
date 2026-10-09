import type { Theme } from '../types/index.ts'

export const THEME_STORAGE_KEY = 'reading-shelf.theme'

// index.html resolves storage before first paint. React adopts that result once,
// then owns the selection; never re-read storage or consult the system scheme.
export function initialTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#211F1B' : '#F4F0E8')
  try { localStorage.setItem(THEME_STORAGE_KEY, theme) } catch { /* Keep manual selection usable for this session. */ }
}
