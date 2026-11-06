/** Accent colour themes, unlocked by level: a theme changes only the primary colour (see the theme block in styles.css). Pure helpers plus a tiny DOM/storage layer at the bottom. */

export type ThemeId = 'neon' | 'ocean' | 'forest' | 'ember'
export type Theme = { id: ThemeId; name: string; level: number; blurb: string }

export const THEMES: readonly Theme[] = [
  { id: 'neon', name: 'Terracotta', level: 1, blurb: 'Warm clay, the arcade’s own' },
  { id: 'ocean', name: 'Ocean', level: 2, blurb: 'A cool blue accent' },
  { id: 'forest', name: 'Forest', level: 3, blurb: 'A fresh green accent' },
  { id: 'ember', name: 'Ember', level: 5, blurb: 'A warm coral accent' },
]

export const DEFAULT_THEME: ThemeId = 'neon'
export const isThemeId = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v)
export const isUnlocked = (id: ThemeId, level: number): boolean => level >= (THEMES.find((t) => t.id === id)?.level ?? Infinity)

/** The theme to actually use: the stored choice if it exists and is unlocked, otherwise the default. */
export const resolveTheme = (stored: unknown, level: number): ThemeId => (isThemeId(stored) && isUnlocked(stored, level) ? stored : DEFAULT_THEME)

// ---- browser layer ---------------------------------------------------------------------------------

const KEY = 'govibearcadia.theme'

export function storedTheme(): ThemeId | null {
  try {
    const v = localStorage.getItem(KEY)
    return isThemeId(v) ? v : null
  } catch {
    return null
  }
}

/** Applies a theme to the page and remembers it. Storage may be unavailable; the theme still applies. */
export function applyTheme(id: ThemeId, remember = true): void {
  document.documentElement.dataset.theme = id
  if (!remember) return
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* private mode or blocked storage: the choice just won't persist */
  }
}
