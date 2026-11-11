/** Accent colour themes, unlocked by level: a theme changes only the primary colour (see the theme block in styles.css). Pure helpers plus a tiny DOM/storage layer at the bottom. */

export type ThemeId = 'neon' | 'ocean' | 'forest' | 'ember' | 'slate' | 'rose' | 'royal' | 'gold'
export type Theme = { id: ThemeId; name: string; level: number; blurb: string; /** Coins; a priced theme must be bought, whatever your level. */ price?: number }

export const THEMES: readonly Theme[] = [
  { id: 'neon', name: 'Terracotta', level: 1, blurb: 'Warm clay, the arcade’s own' },
  { id: 'ocean', name: 'Ocean', level: 2, blurb: 'A cool blue accent' },
  { id: 'forest', name: 'Forest', level: 3, blurb: 'A fresh green accent' },
  { id: 'ember', name: 'Ember', level: 5, blurb: 'A warm coral accent' },
  { id: 'slate', name: 'Slate', level: 1, blurb: 'A calm steel accent', price: 150 },
  { id: 'rose', name: 'Rose', level: 1, blurb: 'A deep rose accent', price: 250 },
  { id: 'royal', name: 'Royal', level: 1, blurb: 'A rich purple accent', price: 400 },
  { id: 'gold', name: 'Gold', level: 1, blurb: 'A burnished gold accent', price: 600 },
]

export const DEFAULT_THEME: ThemeId = 'neon'
export const isThemeId = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v)
/** Free themes open by level; priced themes open only once bought (`owned` lists the bought item ids). */
export const isUnlocked = (id: ThemeId, level: number, owned: readonly string[] = []): boolean => {
  const t = THEMES.find((x) => x.id === id)
  if (!t) return false
  return t.price !== undefined ? owned.includes(id) : level >= t.level
}

/** The theme to actually use: the stored choice if it exists and is unlocked, otherwise the default. */
export const resolveTheme = (stored: unknown, level: number, owned: readonly string[] = []): ThemeId => (isThemeId(stored) && isUnlocked(stored, level, owned) ? stored : DEFAULT_THEME)

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
