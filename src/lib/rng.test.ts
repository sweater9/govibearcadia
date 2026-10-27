import { describe, expect, it } from 'vitest'
import { createRandom, dailySeed, hashSeed, mulberry32, shuffle } from './rng'

describe('seeded randomness', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRandom('2026-10-27')
    const b = createRandom('2026-10-27')
    expect(Array.from({ length: 8 }, a)).toEqual(Array.from({ length: 8 }, b))
  })

  it('produces different sequences for different seeds', () => {
    const a = Array.from({ length: 8 }, createRandom('2026-10-27'))
    const b = Array.from({ length: 8 }, createRandom('2026-10-28'))
    expect(a).not.toEqual(b)
  })

  it('stays within [0, 1)', () => {
    const random = mulberry32(hashSeed('range'))
    for (let i = 0; i < 1000; i++) {
      const value = random()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('falls back to Math.random without a seed', () => {
    expect(createRandom()).toBe(Math.random)
  })

  it('hashes strings stably', () => {
    expect(hashSeed('arcadia')).toBe(hashSeed('arcadia'))
    expect(hashSeed('arcadia')).not.toBe(hashSeed('arcadiA'))
  })
})

describe('shuffle', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const output = shuffle(input, createRandom('perm'))
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...output].sort((x, y) => x - y)).toEqual(input)
  })

  it('is deterministic for a given seed', () => {
    const input = Array.from({ length: 20 }, (_, i) => i)
    expect(shuffle(input, createRandom('same'))).toEqual(shuffle(input, createRandom('same')))
  })
})

describe('dailySeed', () => {
  it('uses the UTC calendar date so every player gets the same daily seed', () => {
    expect(dailySeed(new Date('2026-10-27T23:30:00Z'))).toBe('2026-10-27')
    expect(dailySeed(new Date('2026-10-28T00:00:01Z'))).toBe('2026-10-28')
  })
})
