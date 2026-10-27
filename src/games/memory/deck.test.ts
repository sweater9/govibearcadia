import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { SYMBOLS, makeDeck, scoreFor } from './deck'

describe('Memory Grid deck', () => {
  it('contains every symbol exactly twice', () => {
    const deck = makeDeck(createRandom('deck'))
    expect(deck).toHaveLength(SYMBOLS.length * 2)
    for (const symbol of SYMBOLS) expect(deck.filter((c) => c.symbol === symbol)).toHaveLength(2)
  })

  it('gives every card a unique id', () => {
    const ids = makeDeck(createRandom('ids')).map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('shuffles deterministically for a seed', () => {
    expect(makeDeck(createRandom('same'))).toEqual(makeDeck(createRandom('same')))
    expect(makeDeck(createRandom('one'))).not.toEqual(makeDeck(createRandom('two')))
  })
})

describe('Memory Grid scoring', () => {
  it('rewards fewer moves and never drops below the floor', () => {
    expect(scoreFor(6)).toBeGreaterThan(scoreFor(12))
    expect(scoreFor(500)).toBe(100)
  })
})
