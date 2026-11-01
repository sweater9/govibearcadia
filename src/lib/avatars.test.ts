import { describe, expect, it } from 'vitest'
import { AVATARS, DEFAULT_AVATAR, getAvatar, isAvatarId, isUnlocked, resolveAvatar } from './avatars'

describe('avatars', () => {
  it('have unique ids, a glyph and a level, and the default is free', () => {
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(AVATARS.length)
    for (const a of AVATARS) {
      expect(a.glyph.length).toBeGreaterThan(0)
      expect(a.level).toBeGreaterThanOrEqual(1)
      expect(a.from).toMatch(/^#[0-9a-f]{6}$/)
      expect(a.to).toMatch(/^#[0-9a-f]{6}$/)
    }
    expect(getAvatar(DEFAULT_AVATAR)?.level).toBe(1)
    expect(AVATARS.filter((a) => a.level === 1).length).toBeGreaterThanOrEqual(4)
  })
  it('unlock by level and never for an unknown id', () => {
    expect(isUnlocked('spark', 1)).toBe(true)
    expect(isUnlocked('crown', 4)).toBe(false)
    expect(isUnlocked('crown', 5)).toBe(true)
    expect(isUnlocked('nope', 99)).toBe(false)
    expect(isAvatarId('star')).toBe(true)
    expect(isAvatarId(null)).toBe(false)
  })
  it('shows the stored choice only when it exists and is unlocked', () => {
    expect(resolveAvatar('crown', 5).id).toBe('crown')
    expect(resolveAvatar('crown', 1).id).toBe(DEFAULT_AVATAR)
    expect(resolveAvatar('<script>', 9).id).toBe(DEFAULT_AVATAR)
    expect(resolveAvatar(undefined, 1).id).toBe(DEFAULT_AVATAR)
  })
})
