import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { CAPACITY, COLORS, TUBES, canMove, isSolved, move, newGame, scoreFor, solvable, undo, type SortState } from './rules'

const state = (tubes: number[][], moves: SortState['moves'] = []): SortState => ({ tubes, moves })

describe('Color Sort rules', () => {
  it('deals the right balls, two empty tubes, and is deterministic per seed', () => {
    const a = newGame(createRandom('cs-1'))
    expect(a.tubes).toHaveLength(TUBES)
    expect(a.tubes.filter((t) => t.length === 0)).toHaveLength(2)
    const counts = new Map<number, number>()
    for (const ball of a.tubes.flat()) counts.set(ball, (counts.get(ball) ?? 0) + 1)
    expect([...counts.keys()].sort()).toEqual(Array.from({ length: COLORS }, (_, i) => i))
    for (const n of counts.values()) expect(n).toBe(CAPACITY)
    expect(newGame(createRandom('cs-1'))).toEqual(a)
    expect(newGame(createRandom('cs-2'))).not.toEqual(a)
  })

  it('only deals unsolved, solvable games (100 seeds)', () => {
    for (let i = 0; i < 100; i++) {
      const game = newGame(createRandom(`solv-${i}`))
      expect(isSolved(game.tubes)).toBe(false)
      expect(solvable(game.tubes, 200000)).toBe(true)
    }
  })

  it('solvable() rejects a position with no way out', () => {
    // Every tube full and mixed: no legal move exists.
    const stuck = [[0, 1, 0, 1], [1, 0, 1, 0]]
    expect(solvable(stuck)).toBe(false)
  })

  it('moves one ball onto an empty tube or a matching top, never onto a different color or a full tube', () => {
    const t = [[0, 1], [1], [], [2, 2, 2, 2], [0, 0, 0, 2]]
    expect(canMove(t, 0, 1)).toBe(true) // 1 onto 1
    expect(canMove(t, 0, 2)).toBe(true) // onto empty
    expect(canMove(t, 1, 0)).toBe(true) // 1 onto the 1 on top of tube 0
    expect(canMove(t, 4, 0)).toBe(false) // 2 onto 1
    expect(canMove(t, 4, 3)).toBe(false) // target is full
    expect(canMove(t, 2, 0)).toBe(false) // nothing to take
    expect(canMove(t, 0, 0)).toBe(false) // same tube
  })

  it('move() records the move and illegal moves return the same object', () => {
    const s = state([[0, 1], [1], []])
    const next = move(s, 0, 1)
    expect(next.tubes).toEqual([[0], [1, 1], []])
    expect(next.moves).toEqual([[0, 1]])
    expect(s.tubes).toEqual([[0, 1], [1], []]) // input untouched
    expect(move(next, 0, 1)).toBe(next) // 0 onto 1 is illegal
  })

  it('undo() restores the previous position, and does nothing at the start', () => {
    const s = state([[0, 1], [1], []])
    expect(undo(s)).toBe(s)
    const next = move(move(s, 0, 2), 1, 0)
    expect(undo(undo(next)).tubes).toEqual(s.tubes)
    expect(undo(undo(next)).moves).toEqual([])
  })

  it('a finished game accepts no more moves', () => {
    const done = state([[0, 0, 0, 0], [], []])
    expect(isSolved(done.tubes)).toBe(true)
    expect(move(done, 0, 1)).toBe(done)
  })

  it('is solved only when every tube is empty or full of one color', () => {
    expect(isSolved([[0, 0, 0, 0], [1, 1, 1, 1], []])).toBe(true)
    expect(isSolved([[0, 0, 0], [1, 1, 1, 1], [0]])).toBe(false)
    expect(isSolved([[0, 0, 0, 1], [1, 1, 1, 0]])).toBe(false)
  })

  it('scores fewer moves higher, with a floor of 100', () => {
    const m = (n: number) => state([[]], Array.from({ length: n }, () => [0, 1] as [number, number]))
    expect(scoreFor(m(30))).toBe(760)
    expect(scoreFor(m(10))).toBeGreaterThan(scoreFor(m(30)))
    expect(scoreFor(m(500))).toBe(100)
  })
})
