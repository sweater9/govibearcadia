import { beforeEach, describe, expect, it } from 'vitest'
import { LEVEL_TARGETS, isLeveled, levelCleared, levelPace, levelTarget, readCleared, saveCleared } from './levels'
import { games as REGISTRY } from '../data/games'

beforeEach(() => localStorage.clear())

describe('levels', () => {
  it('every leveled game exists in the registry', () => {
    const ids = new Set(REGISTRY.map((g) => g.id))
    for (const id of Object.keys(LEVEL_TARGETS)) expect(ids.has(id), id).toBe(true)
  })
  it('level 1 is the original pace; later levels are faster, up to a cap', () => {
    expect(levelPace(1)).toBe(1)
    expect(levelPace(3)).toBeGreaterThan(levelPace(2))
    expect(levelPace(500)).toBe(1.8)
    expect(levelPace(0)).toBe(1)
  })
  it('targets rise by level and stop at the cap', () => {
    expect(levelTarget('pulse-tap', 1)).toBe(1500)
    expect(levelTarget('pulse-tap', 2)).toBe(1700)
    expect(levelTarget('pulse-tap', 99)).toBe(3500)
    expect(levelTarget('chess', 1)).toBe(0)
    expect(isLeveled('pulse-tap')).toBe(true)
    expect(isLeveled('chess')).toBe(false)
  })
  it('a level is cleared by the score or by winning', () => {
    expect(levelCleared('pulse-tap', 1, { score: 1499 })).toBe(false)
    expect(levelCleared('pulse-tap', 1, { score: 1500 })).toBe(true)
    expect(levelCleared('brick-breaker', 5, { score: 10, won: true })).toBe(true)
  })
  it('remembers the highest cleared level and never lowers it', () => {
    saveCleared('pulse-tap', 3)
    saveCleared('pulse-tap', 2)
    expect(readCleared()).toEqual({ 'pulse-tap': 3 })
  })
  it('survives corrupt storage', () => {
    localStorage.setItem('govibearcadia.levels', '{nope')
    expect(readCleared()).toEqual({})
  })
})
