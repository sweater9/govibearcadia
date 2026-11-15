import { describe, expect, it } from 'vitest'
import { createRandom } from './rng'
import { WIN, negamax, pickMove, scoreMoves, searchMove, type SearchGame } from './search'

/** Nim: take 1 to 3 from a pile, whoever takes the last one wins. Piles that are multiples of 4 lose for the side to move. */
type Nim = number
const nim: SearchGame<Nim, number> = {
  moves: (n) => [1, 2, 3].filter((k) => k <= n),
  apply: (n, k) => n - k,
  evaluate: () => 0,
  noMoves: (_n, ply) => -(WIN - ply), // the side to move has nothing left to take: the other side took the last one
}

describe('shared search', () => {
  it('finds the winning move in Nim and avoids losing ones', () => {
    for (const pile of [5, 6, 7, 9, 10, 11]) {
      const best = searchMove(nim, pile, 12, 0, createRandom('n'))!
      expect((pile - best) % 4, `from ${pile}`).toBe(0)
    }
  })
  it('scores a lost position negatively and a won one positively', () => {
    expect(negamax(nim, 8, 12, -Infinity, Infinity)).toBeLessThan(0)
    expect(negamax(nim, 7, 12, -Infinity, Infinity)).toBeGreaterThan(0)
  })
  it('prefers the quicker win', () => {
    const scored = scoreMoves(nim, 3, 6) // taking all 3 wins now; taking fewer wins later or not at all
    const take3 = scored.find((x) => x.move === 3)!.score
    expect(take3).toBe(WIN - 1)
    expect(scored.filter((x) => x.move !== 3).every((x) => x.score < take3)).toBe(true)
  })
  it('alpha-beta gives the same answer as searching everything (no pruning window)', () => {
    const plain = (n: number, d: number): number => {
      const moves = nim.moves(n)
      if (!moves.length) return nim.noMoves!(n, 0)
      if (d === 0) return 0
      return Math.max(...moves.map((k) => -plain(n - k, d - 1)))
    }
    // Compare the sign (win/lose/unknown); exact values differ only by the ply bonus.
    for (let n = 1; n <= 12; n++) expect(Math.sign(negamax(nim, n, 14, -Infinity, Infinity))).toBe(Math.sign(plain(n, 14)))
  })
  it('uses the order hook and the leaf hook when given', () => {
    const seen: number[] = []
    const g: SearchGame<number, number> = { ...nim, order: (_s, m) => [...m].reverse(), leaf: (s) => { seen.push(s); return 0 } }
    scoreMoves(g, 5, 1)
    expect(seen.length).toBe(3)
    expect(scoreMoves(g, 5, 1).map((x) => x.move)).toEqual([3, 2, 1])
  })
  it('picks within the slack with a seeded random, and only the best at zero slack', () => {
    const scored = [{ move: 'a', score: 10 }, { move: 'b', score: 8 }, { move: 'c', score: 0 }]
    expect(pickMove(scored, 0, createRandom('s'))).toBe('a')
    const picks = new Set(Array.from({ length: 40 }, (_, i) => pickMove(scored, 5, createRandom(`k${i}`))))
    expect([...picks].sort()).toEqual(['a', 'b'])
    expect(pickMove([], 0, createRandom('s'))).toBeNull()
    expect(pickMove(scored, 5, createRandom('z'))).toBe(pickMove(scored, 5, createRandom('z')))
  })
})
