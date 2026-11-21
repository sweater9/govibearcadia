import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY, readSave, recordEndless, recordLevel, writeSave } from './storage'

beforeEach(() => localStorage.clear())
const r = (o: Partial<Parameters<typeof recordLevel>[1]> = {}) => ({ n: 1, stars: 1, ms: 20000, score: 150, coins: 0, hits: 0, doors: 0, fog: false, ...o })

describe('maze progress', () => {
  it('starts with level 1 unlocked and survives bad data', () => {
    expect(readSave()).toEqual(EMPTY)
    localStorage.setItem('govibearcadia.maze', '{nope')
    expect(readSave()).toEqual(EMPTY)
    localStorage.setItem('govibearcadia.maze', JSON.stringify({ unlocked: 999, levels: { 7: { stars: 9 }, 80: { stars: 1 } }, settings: { difficulty: 'wild' } }))
    const s = readSave()
    expect(s.unlocked).toBe(50)
    expect(s.levels[7].stars).toBe(3)
    expect(s.levels[80]).toBeUndefined()
    expect(s.settings.difficulty).toBe('normal')
  })
  it('finishing a level unlocks the next, keeps the best, and round-trips', () => {
    let { save } = recordLevel(EMPTY, r({ n: 1, stars: 2, ms: 30000, score: 200 }))
    expect(save.unlocked).toBe(2)
    save = recordLevel(save, r({ n: 1, stars: 1, ms: 20000, score: 100 })).save
    expect(save.levels[1]).toEqual({ stars: 2, bestMs: 20000, bestScore: 200 })
    expect(save.unlocked).toBe(2)
    writeSave(save)
    expect(readSave()).toEqual(save)
  })
  it('never unlocks past level 50', () => {
    expect(recordLevel(EMPTY, r({ n: 50 })).save.unlocked).toBe(50)
  })
  it('achievements are awarded once', () => {
    const a = recordLevel(EMPTY, r())
    expect(a.earned).toEqual(['first-exit'])
    expect(recordLevel(a.save, r()).earned).toEqual([])
    const b = recordLevel(EMPTY, r({ n: 10, hits: 0, doors: 2, fog: true, coins: 100 }))
    expect(b.earned).toEqual(expect.arrayContaining(['untouched', 'key-master', 'fog-walker', 'coin-hoarder', 'level-10']))
    expect(recordLevel(EMPTY, r({ n: 3, hits: 0 })).earned).not.toContain('untouched')
  })
  it('endless keeps the best ten and awards run achievements', () => {
    let s = EMPTY
    for (let i = 0; i < 12; i++) s = recordEndless(s, { mazes: i, distance: i * 50, timeMs: 1000, day: '2026-11-21' }).save
    expect(s.endless.top).toHaveLength(10)
    expect(s.endless.top[0].mazes).toBe(11)
    const res = recordEndless(EMPTY, { mazes: 15, distance: 900, timeMs: 1, day: 'd' })
    expect(res.earned).toEqual(['endless-5', 'endless-15'])
    expect(res.best).toBe(true)
    expect(recordEndless(res.save, { mazes: 2, distance: 1, timeMs: 1, day: 'd' }).best).toBe(false)
  })
})
