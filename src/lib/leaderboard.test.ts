import { describe, expect, it } from 'vitest'
import { createRandom } from './rng'
import { ADJECTIVES, NOUNS, dayKey, isNick, isRankedGame, nickName, randomNick, weekKey } from './leaderboard'

describe('nicknames', () => {
  it('are made only from the word lists, and random ones are always valid', () => {
    const r = createRandom('n')
    for (let i = 0; i < 200; i++) {
      const nick = randomNick(r)
      expect(isNick(nick)).toBe(true)
      expect(nickName(nick)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,2}$/)
    }
    expect(nickName({ a: 0, n: 1, k: 42 })).toBe('Brave Falcon 42')
  })
  it('rejects anything that is not three in-range whole numbers', () => {
    expect(isNick({ a: 0, n: 0, k: 0 })).toBe(true)
    expect(isNick({ a: ADJECTIVES.length - 1, n: NOUNS.length - 1, k: 99 })).toBe(true)
    for (const bad of [null, 'Brave Otter 1', {}, { a: -1, n: 0, k: 0 }, { a: ADJECTIVES.length, n: 0, k: 0 }, { a: 0, n: NOUNS.length, k: 0 }, { a: 0, n: 0, k: 100 }, { a: 0.5, n: 0, k: 0 }, { a: '0', n: 0, k: 0 }, { a: 0, n: 0 }]) expect(isNick(bad)).toBe(false)
  })
  it('the word lists have no duplicates', () => {
    expect(new Set(ADJECTIVES).size).toBe(ADJECTIVES.length)
    expect(new Set(NOUNS).size).toBe(NOUNS.length)
  })
})

describe('time keys', () => {
  it('weeks start on Monday, UTC', () => {
    expect(weekKey(new Date('2026-11-02T00:00:00Z'))).toBe('2026-11-02') // a Monday
    expect(weekKey(new Date('2026-11-01T23:59:59Z'))).toBe('2026-10-26') // the Sunday before
    expect(weekKey(new Date('2026-11-04T12:00:00Z'))).toBe('2026-11-02')
    expect(weekKey(new Date('2026-01-01T00:00:00Z'))).toBe('2025-12-29')
    expect(dayKey(new Date('2026-11-01T23:59:59Z'))).toBe('2026-11-01')
  })
})

describe('ranked games', () => {
  it('are exactly the games with online rooms', () => {
    for (const g of ['connect-four', 'tic-tac-toe', 'checkers', 'battleship']) expect(isRankedGame(g)).toBe(true)
    for (const g of ['neon-pong', 'all', '', null]) expect(isRankedGame(g)).toBe(false)
  })
})
