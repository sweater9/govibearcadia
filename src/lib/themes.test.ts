import { describe, expect, it } from 'vitest'
import { THEMES, applyTheme, isThemeId, isUnlocked, resolveTheme, storedTheme } from './themes'

describe('themes', () => {
  it('unlock at their level and the default is always available', () => {
    const free = THEMES.filter((t) => t.price === undefined)
    expect(free.map((t) => [t.id, t.level])).toEqual([['neon', 1], ['ocean', 2], ['forest', 3], ['ember', 5]])
    expect([1, 2, 3, 4, 5].map((l) => free.filter((t) => isUnlocked(t.id, l)).length)).toEqual([1, 2, 3, 3, 4])
  })
  it('priced themes open only once bought, whatever the level', () => {
    expect(isUnlocked('royal', 99)).toBe(false)
    expect(isUnlocked('royal', 1, ['royal'])).toBe(true)
    expect(resolveTheme('royal', 1, [])).toBe('neon')
    expect(resolveTheme('royal', 1, ['royal'])).toBe('royal')
  })

  it('resolve falls back to the default for unknown or locked themes', () => {
    expect(resolveTheme('ember', 5)).toBe('ember')
    expect(resolveTheme('ember', 4)).toBe('neon')
    expect(resolveTheme('hacker', 99)).toBe('neon')
    expect(resolveTheme(null, 99)).toBe('neon')
    expect(isThemeId('<script>')).toBe(false)
  })

  it('apply sets the page attribute and remembers the choice; junk in storage is ignored', () => {
    applyTheme('ocean')
    expect(document.documentElement.dataset.theme).toBe('ocean')
    expect(storedTheme()).toBe('ocean')
    localStorage.setItem('govibearcadia.theme', 'nope')
    expect(storedTheme()).toBeNull()
    applyTheme('forest', false)
    expect(storedTheme()).toBeNull()
  })
})
