import { describe, expect, it } from 'vitest'
import { counts, isComplete, shanten, splits, tileName } from './tiles'

const hand = (...parts: string[]) => {
  const out: number[] = []
  for (const p of parts) {
    const suit = { c: 0, d: 9, b: 18 }[p.slice(-1) as 'c' | 'd' | 'b']
    if (suit !== undefined) for (const ch of p.slice(0, -1)) out.push(suit + Number(ch) - 1)
    else if (p.startsWith('h')) for (const ch of p.slice(1)) out.push(26 + Number(ch)) // h1=East..h7=White
  }
  return out
}

describe('tiles', () => {
  it('names tiles in English', () => {
    expect(tileName(0)).toBe('1 Characters')
    expect(tileName(26)).toBe('9 Bamboo')
    expect(tileName(27)).toBe('East')
    expect(tileName(33)).toBe('White Dragon')
    expect(tileName(41)).toBe('Bamboo flower')
  })
})

describe('16-tile hands: five sets and a pair', () => {
  it('recognises a complete 17-tile hand', () => {
    const h = hand('123c', '456d', '789b', '111c', 'h11', '234d') // 3+3+3+3+2+3 = 17
    expect(h).toHaveLength(17)
    expect(isComplete(counts(h), 0)).toBe(true)
  })
  it('knows exposed sets reduce what the hand must hold', () => {
    expect(isComplete(counts(hand('123c', '456d', '99b')), 3)).toBe(true) // two sets and a pair, three on the table
    expect(isComplete(counts(hand('123c', '99b')), 3)).toBe(false) // one set short
    expect(isComplete(counts(hand('99b')), 5)).toBe(true) // only the pair left
    expect(isComplete(counts(hand('123c', '99b')), 4)).toBe(true)
  })
  it('rejects 17 tiles that are not five sets and a pair', () => {
    const h = hand('123c', '456d', '789b', '111c', 'h13', '234d')
    expect(isComplete(counts(h), 0)).toBe(false)
  })
  it('finds every way to split an ambiguous hand', () => {
    const c = counts(hand('111222333c', '55d', '678b', '234d', '99b').slice(0, 14)) // 111222333c + 55d + 678b? just tiles
    expect(splits(counts(hand('111222333c', '55d')), 3).length).toBe(2) // three pungs, or three chows
    expect(c.length).toBe(34)
  })
  it('does not let a chow run off the end of a suit or into the next', () => {
    expect(splits(counts(hand('89c', '1d', '99b')), 1)).toHaveLength(0)
  })
})

describe('shanten', () => {
  it('is -1 for a complete hand and 0 for a hand one tile away', () => {
    expect(shanten(counts(hand('123c', '456d', '789b', '111c', 'h11', '234d')), 0)).toBe(-1)
    expect(shanten(counts(hand('123c', '456d', '789b', '111c', 'h1', '234d')), 0)).toBe(0)
  })
  it('counts melds already on the table', () => {
    expect(shanten(counts(hand('99b')), 5)).toBe(-1)
    expect(shanten(counts(hand('123c', '9b')), 4)).toBe(0)
    expect(shanten(counts(hand('99b')), 4)).toBe(1)
  })
  it('a scattered hand is far away', () => {
    expect(shanten(counts(hand('159c', '159d', '159b', 'h1234567').slice(0, 16)), 0)).toBeGreaterThanOrEqual(5)
  })
})
