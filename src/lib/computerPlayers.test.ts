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
