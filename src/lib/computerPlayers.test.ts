import { describe, expect, it } from 'vitest'
import { COMPUTER_PLAYERS, computerLabel, parseComputer, pickComputer } from './computerPlayers'

describe('computer players', () => {
  it('has the five chosen names', () => expect([...COMPUTER_PLAYERS]).toEqual(['Ada', 'Zara', 'Mei', 'Sophia', 'Ananya']))
  it('always labels them as computers', () => expect(computerLabel('Ada')).toBe('Ada (computer)'))
  it('accepts only known names', () => {
    expect(parseComputer('Mei')).toBe('Mei')
    expect(parseComputer('<b>x</b>')).toBeNull()
    expect(parseComputer(null)).toBeNull()
  })
  it('picks within range at the extremes', () => {
    expect(pickComputer(() => 0)).toBe('Ada')
    expect(pickComputer(() => 0.999999)).toBe('Ananya')
    expect(pickComputer(() => 1)).toBe('Ananya')
  })
})

import { STRENGTH, byStrength } from './computerPlayers'
describe('strength', () => {
  it('orders the five from gentlest to hardest', () => expect(['Ada', 'Mei', 'Zara', 'Sophia', 'Ananya'].map((n) => STRENGTH[n as keyof typeof STRENGTH])).toEqual([0, 1, 2, 3, 4]))
  it('uses the game default without a named computer', () => {
    expect(byStrength(null, [1, 2, 3, 4, 5], 4)).toBe(4)
    expect(byStrength('nobody', [1, 2, 3, 4, 5], 4)).toBe(4)
  })
  it('maps each name to its table entry', () => {
    expect(byStrength('Ada', [1, 2, 3, 4, 5], 4)).toBe(1)
    expect(byStrength('Ananya', [1, 2, 3, 4, 5], 4)).toBe(5)
  })
})
