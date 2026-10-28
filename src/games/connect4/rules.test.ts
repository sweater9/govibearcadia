import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { COLS, ROWS, aiMove, drop, idx, isOver, legalCols, newGame, scoreFor, type C4State } from './rules'

const play = (cols: number[], from: C4State = newGame()): C4State => cols.reduce((s, c) => drop(s, c), from)

describe('Connect Four rules', () => {
  it('drops pieces to the lowest free row and alternates players', () => {
    const s = play([3, 3])
    expect(s.cells[idx(ROWS - 1, 3)]).toBe(1)
    expect(s.cells[idx(ROWS - 2, 3)]).toBe(2)
    expect(s.turn).toBe(1)
    expect(s.moves).toBe(2)
  })

  it('rejects a full column and out-of-range columns without changing state', () => {
    const full = play([0, 0, 0, 0, 0, 0])
    expect(legalCols(full)).not.toContain(0)
    expect(drop(full, 0)).toBe(full)
    expect(drop(newGame(), -1)).toEqual(newGame())
    expect(drop(newGame(), COLS)).toEqual(newGame())
  })

  it('detects horizontal, vertical and both diagonal wins, and records the line', () => {
    const horizontal = play([0, 0, 1, 1, 2, 2, 3])
    expect(horizontal.winner).toBe(1)
    expect(horizontal.line).toEqual([35, 36, 37, 38])
    expect(play([0, 1, 0, 1, 0, 1, 0]).winner).toBe(1) // vertical
    // rising diagonal for player 1
    expect(play([0, 1, 1, 2, 3, 2, 2, 3, 3, 6, 3]).winner).toBe(1)
    // falling diagonal for player 1 (mirror)
    expect(play([6, 5, 5, 4, 3, 4, 4, 3, 3, 0, 3]).winner).toBe(1)
  })

  it('stops accepting moves once the game is over', () => {
    const won = play([0, 0, 1, 1, 2, 2, 3])
    expect(isOver(won)).toBe(true)
    expect(legalCols(won)).toEqual([])
    expect(drop(won, 4)).toBe(won)
  })

  it('detects a full-board draw', () => {
    // A known sequence that fills all 42 cells without anyone making four.
    const seq = [0,1,0,1,0,1,1,0,1,0,1,0, 2,3,2,3,2,3,3,2,3,2,3,2, 4,5,4,5,4,5,5,4,5,4,5,4, 6,6,6,6,6,6]
    const s = play(seq)
    expect(s.winner).toBe(0)
    expect(s.moves).toBe(42)
    expect(s.draw).toBe(true)
    expect(scoreFor(s)).toBe(300)
  })

  it('the computer takes an immediate win', () => {
    // Computer (player 2) has three in column 6 on its turn.
    const s = play([0, 6, 1, 6, 0, 6, 1])
    expect(s.turn).toBe(2)
    expect(aiMove(s, createRandom('a'))).toBe(6)
  })

  it('the computer blocks an immediate human win', () => {
    const s = play([0, 6, 1, 6, 2]) // human threatens 0-1-2-3 on the bottom row
    expect(s.turn).toBe(2)
    expect(aiMove(s, createRandom('b'))).toBe(3)
  })

  it('always plays a legal column, is deterministic per seed, and never moves on a finished game', () => {
    let s = newGame()
    const random = createRandom('ai-seed')
    while (!isOver(s)) {
      const col = s.turn === 2 ? aiMove(s, random) : aiMove(s, random, 2)
      expect(legalCols(s)).toContain(col)
      s = drop(s, col)
    }
    expect(aiMove(s, random)).toBe(-1)
    const a = aiMove(newGame(), createRandom('x'))
    expect(aiMove(newGame(), createRandom('x'))).toBe(a)
  })

  it('scores quick wins higher and a loss at zero', () => {
    const quick = play([0, 0, 1, 1, 2, 2, 3])
    expect(scoreFor(quick)).toBe(1000 - 30 * 4)
    const lost = play([0, 3, 0, 3, 1, 3, 1, 3])
    expect(lost.winner).toBe(2)
    expect(scoreFor(lost)).toBe(0)
  })
})
