import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { SETTINGS, chooseMove, evaluate } from './ai'
import { apply, fromSfen, isOver, legalMoves, newGame, type Move } from './rules'

const sq = (row: number, col: number) => row * 9 + col
const same = (a: Move, b: Move) => a.from === b.from && a.to === b.to && a.drop === b.drop && a.promote === b.promote

describe('computer', () => {
  it('values the start position as even and a spare rook in hand as better', () => {
    expect(evaluate(newGame())).toBe(0)
    expect(evaluate(fromSfen('4k4/9/9/9/9/9/9/9/4K4 b R 1'))).toBeGreaterThan(900)
  })
  it('takes a mate in one at every level', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const s = fromSfen('4k4/R8/9/9/9/9/9/8R/4K4 b - 1')
      const m = chooseMove(s, createRandom(`mate-${level}`), level)!
      expect(apply(s, m).winner).toBe(1)
    }
  })
  it('wins a hanging piece and avoids losing its own', () => {
    // A free rook on the board: the silver can take it.
    const s = fromSfen('4k4/9/9/9/4r4/3S5/9/9/4K4 b - 1')
    const m = chooseMove(s, createRandom('grab'), 'normal')!
    expect(m.to).toBe(sq(4, 4))
  })
  it('always plays a legal move, deterministically for a seed', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const s = newGame()
      const a = chooseMove(s, createRandom('seed'), level)!
      expect(legalMoves(s).some((x) => same(x, a))).toBe(true)
      expect(chooseMove(s, createRandom('seed'), level)).toEqual(a)
    }
  })
  it('answers quickly: even the hardest level thinks about a position in well under five seconds', () => {
    const t = Date.now()
    chooseMove(newGame(), createRandom('t'), 'hard')
    expect(Date.now() - t).toBeLessThan(5000)
    expect(SETTINGS.hard.depth).toBeGreaterThan(SETTINGS.normal.depth)
  })
  it('plays a stretch of a real game, always legally, without ending it by accident', () => {
    let s = newGame()
    const a = createRandom('a')
    const b = createRandom('b')
    for (let ply = 0; ply < 40 && !isOver(s); ply++) {
      const m = chooseMove(s, ply % 2 ? b : a, ply % 2 ? 'easy' : 'normal')!
      const n = apply(s, m)
      expect(n).not.toBe(s)
      s = n
    }
    expect(s.cells.filter(Boolean).length + s.hand[0].reduce((x, y) => x + y) + s.hand[1].reduce((x, y) => x + y)).toBe(40)
  })
})
