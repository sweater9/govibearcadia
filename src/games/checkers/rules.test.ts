import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { aiStep, interact, isOver, isState, legalSteps, newGame, scoreFor, sq, step, type CState, type Cell } from './rules'

/** A custom position: pieces given as [row, col, cell]. */
const pos = (pieces: [number, number, Cell][], turn: 1 | 2 = 1): CState => {
  const cells = Array<Cell>(64).fill(0)
  for (const [r, c, v] of pieces) cells[sq(r, c)] = v
  return { cells, turn, winner: 0, chain: null, moves: 0, quiet: 0, draw: false }
}

describe('checkers setup and simple moves', () => {
  it('starts with 12 pieces each on dark squares and 7 legal opening moves', () => {
    const s = newGame()
    expect(s.cells.filter((c) => c === 1)).toHaveLength(12)
    expect(s.cells.filter((c) => c === 2)).toHaveLength(12)
    expect(legalSteps(s)).toHaveLength(7)
  })
  it('moves a man diagonally forward only, and passes the turn', () => {
    const s = step(newGame(), sq(5, 0), sq(4, 1))
    expect(s.cells[sq(4, 1)]).toBe(1)
    expect(s.turn).toBe(2)
    expect(step(newGame(), sq(5, 0), sq(6, 1))).toEqual(newGame()) // backwards / occupied
    expect(step(newGame(), sq(5, 0), sq(5, 1))).toEqual(newGame()) // not diagonal
  })
  it('rejects non-numbers and the wrong player', () => {
    const s = newGame()
    expect(step(s, '40', 33)).toBe(s)
    expect(step(s, sq(2, 1), sq(3, 0))).toBe(s)
  })
})

describe('captures', () => {
  it('a capture is mandatory: slides are illegal while a jump exists', () => {
    const s = pos([[4, 3, 1], [3, 4, 2], [6, 1, 1]])
    expect(legalSteps(s)).toEqual([{ from: sq(4, 3), to: sq(2, 5), captured: sq(3, 4) }])
    expect(step(s, sq(6, 1), sq(5, 0))).toBe(s)
  })
  it('removes the captured piece', () => {
    const s = step(pos([[4, 3, 1], [3, 4, 2], [0, 1, 2]]), sq(4, 3), sq(2, 5))
    expect(s.cells[sq(3, 4)]).toBe(0)
    expect(s.cells[sq(2, 5)]).toBe(1)
  })
  it('a multi-jump keeps the turn on the same piece until it is finished', () => {
    const s = pos([[6, 1, 1], [5, 2, 2], [3, 4, 2], [0, 7, 2]])
    const first = step(s, sq(6, 1), sq(4, 3))
    expect(first.turn).toBe(1)
    expect(first.chain).toBe(sq(4, 3))
    expect(legalSteps(first)).toEqual([{ from: sq(4, 3), to: sq(2, 5), captured: sq(3, 4) }])
    const second = step(first, sq(4, 3), sq(2, 5))
    expect(second.turn).toBe(2)
    expect(second.chain).toBeNull()
  })
  it('a man that reaches the far row is crowned and its move ends, even if it could jump on', () => {
    const s = pos([[2, 3, 1], [1, 4, 2], [1, 2, 2], [7, 0, 2]])
    const next = step(s, sq(2, 3), sq(0, 5))
    expect(next.cells[sq(0, 5)]).toBe(3)
    expect(next.turn).toBe(2)
    expect(next.chain).toBeNull()
  })
  it('kings move and capture backwards', () => {
    const s = pos([[3, 3, 3], [4, 4, 2], [0, 7, 2]])
    expect(legalSteps(s)).toEqual([{ from: sq(3, 3), to: sq(5, 5), captured: sq(4, 4) }])
  })
})

describe('the end of a game', () => {
  it('wins when the opponent has no pieces', () => {
    const s = step(pos([[4, 3, 1], [3, 4, 2]]), sq(4, 3), sq(2, 5))
    expect(s.winner).toBe(1)
    expect(isOver(s)).toBe(true)
    expect(legalSteps(s)).toEqual([])
  })
  it('wins when the opponent is completely blocked', () => {
    const s = pos([[0, 1, 2], [1, 0, 1], [1, 2, 1], [2, 3, 1], [5, 4, 1]])
    // Player 1 plays (5,4)->(4,3); player 2's man at (0,1) is already boxed in by (1,0) and (1,2) which cannot be jumped.
    const next = step(s, sq(5, 4), sq(4, 3))
    expect(next.winner).toBe(1)
  })
  it('is a draw after a long run of quiet king moves', () => {
    const before = { ...pos([[7, 0, 3], [0, 7, 4], [4, 4, 4]]), quiet: 79 }
    const after = step(before, sq(7, 0), sq(6, 1))
    expect(after.draw).toBe(true)
    expect(isOver(after)).toBe(true)
    expect(step(pos([[7, 0, 3], [0, 7, 4], [4, 4, 4]]), sq(7, 0), sq(6, 1)).draw).toBe(false)
  })
  it('a man move or a capture resets the quiet count', () => {
    expect(step({ ...newGame(), quiet: 50 }, sq(5, 0), sq(4, 1)).quiet).toBe(0)
  })
  it('scores', () => {
    const win = step(pos([[4, 3, 1], [3, 4, 2]]), sq(4, 3), sq(2, 5))
    expect(scoreFor(win)).toBe(996)
    expect(scoreFor({ ...win, winner: 2 })).toBe(0)
    expect(scoreFor({ ...win, winner: 0, draw: true })).toBe(300)
  })
})

describe('the computer', () => {
  it('only plays legal steps and finishes whole games', () => {
    for (const seed of ['a', 'b']) {
      const r = createRandom(seed)
      let s = newGame()
      for (let i = 0; i < 400 && !isOver(s); i++) {
        const m = aiStep(s, r, 2)!
        expect(legalSteps(s)).toContainEqual(m)
        s = step(s, m.from, m.to)
      }
      expect(isOver(s)).toBe(true)
    }
  })
  it('takes the capture when one is forced', () => {
    const s = pos([[3, 2, 2], [4, 3, 1], [7, 6, 1]], 2)
    expect(aiStep(s, createRandom('z'))).toEqual({ from: sq(3, 2), to: sq(5, 4), captured: sq(4, 3) })
  })
  it('has no step when the game is over', () => {
    const s = step(pos([[4, 3, 1], [3, 4, 2]]), sq(4, 3), sq(2, 5))
    expect(aiStep(s)).toBeNull()
  })
  it('plays the same game for the same seed', () => {
    const go = (seed: string) => {
      const r = createRandom(seed)
      let s = newGame()
      for (let i = 0; i < 300 && !isOver(s); i++) {
        const m = aiStep(s, r, 2)!
        s = step(s, m.from, m.to)
      }
      return s.cells.join('')
    }
    expect(go('q')).toBe(go('q'))
  })
  it('validates stored state', () => {
    expect(isState(newGame())).toBe(true)
    expect(isState({ ...newGame(), cells: [] })).toBe(false)
    expect(isState(null)).toBe(false)
  })
})

describe('interact', () => {
  const s = newGame()
  it('picks a piece that can move, moves it to a legal square, and drops other picks', () => {
    expect(interact(s, 1, null, sq(5, 0))).toEqual({ select: sq(5, 0) })
    expect(interact(s, 1, sq(5, 0), sq(4, 1))).toEqual({ select: null, move: { from: sq(5, 0), to: sq(4, 1) } })
    expect(interact(s, 1, sq(5, 0), sq(3, 3))).toEqual({ select: null })
    expect(interact(s, 1, null, sq(7, 0))).toEqual({ select: null }) // blocked piece
    expect(interact(s, 2, null, sq(2, 1))).toEqual({ select: null }) // not their turn
  })
  it('keeps the jumping piece picked in a chain', () => {
    const first = step(pos([[6, 1, 1], [5, 2, 2], [3, 4, 2], [0, 7, 2]]), sq(6, 1), sq(4, 3))
    expect(interact(first, 1, null, sq(0, 0))).toEqual({ select: sq(4, 3) })
  })
})
