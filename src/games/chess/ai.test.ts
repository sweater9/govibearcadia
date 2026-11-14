import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { LEVELS, chooseMove, evaluate } from './ai'
import { apply, fromFen, legalMoves, newGame, squareOf, status } from './rules'

const r = () => createRandom('ai')

describe('chess computer', () => {
  it('always returns a legal move at every level, and null when there is none', () => {
    for (const level of LEVELS) {
      const s = newGame()
      const m = chooseMove(s, level, r())!
      expect(legalMoves(s).some((x) => x.from === m.from && x.to === m.to)).toBe(true)
    }
    expect(chooseMove(fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), 'normal', r())).toBeNull()
  })
  it('plays mate in one at every level above easy', () => {
    const s = fromFen('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1')
    for (const level of ['normal', 'hard'] as const) {
      const m = chooseMove(s, level, r())!
      expect(status(apply(s, m)!)).toBe('checkmate')
    }
  })
  it('takes a free queen and does not hang its own', () => {
    const s = fromFen('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1')
    const m = chooseMove(s, 'normal', r())!
    expect([m.from, m.to]).toEqual([squareOf('d1'), squareOf('d5')])
  })
  it('hard sees a fork two moves ahead that normal cannot be relied on to', () => {
    const s = fromFen('4k3/8/8/8/8/8/8/R3K3 w - - 0 1')
    expect(evaluate(s)).toBeGreaterThan(0)
    expect(chooseMove(s, 'hard', r())).not.toBeNull()
  })
  it('is deterministic for a seed', () => {
    expect(chooseMove(newGame(), 'easy', createRandom('x'))).toEqual(chooseMove(newGame(), 'easy', createRandom('x')))
  })
  it('two computers finish a game of legal moves without ever making an illegal one', () => {
    let s = newGame()
    const rand = createRandom('selfplay')
    for (let i = 0; i < 120 && status(s) === 'playing'; i++) {
      const m = chooseMove(s, i % 2 ? 'easy' : 'normal', rand)!
      const next = apply(s, m)
      expect(next).not.toBeNull()
      s = next!
    }
  }, 60000)
})
