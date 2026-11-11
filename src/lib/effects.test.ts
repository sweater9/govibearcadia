import { describe, expect, it } from 'vitest'
import { createRandom } from './rng'
import { confettiPieces, scoreGain } from './effects'

describe('effects', () => {
  it('confetti is deterministic for a seed and lands below the origin on average', () => {
    expect(confettiPieces(10, createRandom('a'))).toEqual(confettiPieces(10, createRandom('a')))
    expect(confettiPieces(36, createRandom('b'))).toHaveLength(36)
  })
  it('score gain only counts plain numeric rises', () => {
    expect(scoreGain('10', '25')).toBe(15)
    expect(scoreGain('25', '10')).toBe(0)
    expect(scoreGain('10', '10')).toBe(0)
    expect(scoreGain('1:20', '1:30')).toBe(0)
    expect(scoreGain(null, '5')).toBe(0)
  })
})
