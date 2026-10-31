import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { aiMove, isOver, legalCells, newGame, play, scoreFor, type TState } from './rules'

const run = (moves: number[]): TState => moves.reduce((s, m) => play(s, m), newGame())

describe('tic-tac-toe rules', () => {
  it('alternates turns and rejects occupied or out-of-range cells', () => {
    const s = play(newGame(), 4)
    expect(s.turn).toBe(2)
    expect(play(s, 4)).toBe(s)
    expect(play(s, 9)).toBe(s)
    expect(play(s, -1)).toBe(s)
    expect(play(s, 1.5)).toBe(s)
    expect(play(s, '3')).toBe(s)
  })
  it('detects a win and the winning line, then refuses more moves', () => {
    const s = run([0, 3, 1, 4, 2])
    expect(s.winner).toBe(1)
    expect(s.line).toEqual([0, 1, 2])
    expect(isOver(s)).toBe(true)
    expect(play(s, 8)).toBe(s)
    expect(legalCells(s)).toEqual([])
  })
  it('detects a draw', () => {
    const s = run([0, 1, 2, 4, 3, 5, 7, 6, 8])
    expect(s.winner).toBe(0)
    expect(s.draw).toBe(true)
  })
  it('scores faster wins higher, draws something, losses nothing', () => {
    expect(scoreFor(run([0, 3, 1, 4, 2]))).toBe(700)
    expect(scoreFor(run([0, 1, 2, 4, 3, 5, 7, 6, 8]))).toBe(200)
    expect(scoreFor(run([0, 1, 3, 4, 8, 7]))).toBe(0)
  })
})

describe('tic-tac-toe computer', () => {
  it('takes a win when it has one, and blocks when it must', () => {
    const win = run([0, 3, 1, 4, 8]) // O to move with 3,4 -> 5
    expect(aiMove(win, createRandom('a'), 0)).toBe(5)
    const block = run([0, 4, 1]) // O must block 2
    expect(aiMove(block, createRandom('a'), 0)).toBe(2)
  })
  it('never loses when it does not slip, whatever X plays', () => {
    const rnd = createRandom('sweep')
    for (let game = 0; game < 60; game++) {
      let s = newGame()
      while (!isOver(s)) {
        s = s.turn === 1 ? play(s, legalCells(s)[Math.floor(rnd() * legalCells(s).length)]) : play(s, aiMove(s, rnd, 0))
      }
      expect(s.winner).not.toBe(1)
    }
  })
  it('plays the same game for the same seed', () => {
    const go = (seed: string) => {
      const r = createRandom(seed)
      let s = newGame()
      while (!isOver(s)) s = play(s, aiMove(s, r))
      return s.cells
    }
    expect(go('x')).toEqual(go('x'))
  })
  it('returns -1 when the game is over', () => {
    expect(aiMove(run([0, 3, 1, 4, 2]))).toBe(-1)
  })
})
