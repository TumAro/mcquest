import type { Theme } from './storage'

/** Light and dark set an explicit choice; system removes it so the OS preference decides (D-06). */
export function applyTheme(theme: Theme): void {
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}
