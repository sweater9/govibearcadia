import { describe, expect, it } from 'vitest'
import type { Board } from './logic'
import { highestTile, newGame, step, type MergeState } from './state'
import { createRandom } from '../../lib/rng'

const tiles = (board: Board) => board.flat().filter(Boolean).length
const empty = (): Board => Array.from({ length: 4 }, () => Array(4).fill(0))

describe('Neon Merge state', () => {
  it('starts with exactly two tiles and a zero score', () => {
    const game = newGame(createRandom('start'))
    expect(tiles(game.board)).toBe(2)
    expect(game).toMatchObject({ score: 0, over: false })
  })

  it('starts identically for the same seed', () => {
    expect(newGame(createRandom('daily'))).toEqual(newGame(createRandom('daily')))
  })

  it('merges, scores and spawns one new tile', () => {
    const board = empty()
    board[0][0] = 2
    board[0][1] = 2
    const next = step({ board, score: 0, over: false }, 'left', createRandom('merge'))
    expect(next.board[0][0]).toBe(4)
    expect(next.score).toBe(4)
    expect(tiles(next.board)).toBe(2) // one merged tile + one spawn
  })

  it('returns the same object for a move that changes nothing', () => {
    const board = empty()
    board[0][0] = 2
    const state: MergeState = { board, score: 0, over: false }
    expect(step(state, 'left', createRandom('noop'))).toBe(state)
  })

  it('ignores moves once the game is over', () => {
    const state: MergeState = { board: empty(), score: 12, over: true }
    expect(step(state, 'right')).toBe(state)
  })

  it('flags game over when the spawn fills the last gap with no merges left', () => {
    const board: Board = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [2, 4, 2, 0],
    ]
    // Moving right leaves one gap at [3][0]; a roll >= 0.9 spawns a 4, locking the checkerboard.
    const next = step({ board, score: 0, over: false }, 'right', () => 0.95)
    expect(next.board[3]).toEqual([4, 2, 4, 2])
    expect(next.over).toBe(true)
  })

  it('moves correctly in all four directions', () => {
    const board = empty()
    board[0][0] = 2
    board[3][3] = 4
    const results = (['left', 'right', 'up', 'down'] as const).map((dir) => {
      const next = step({ board, score: 0, over: false }, dir, () => 0.99) // spawn never lands on the originals' targets
      return next.board
    })
    expect(results[0][0][0]).toBe(2) // left: 2 stays, 4 slides to column 0 of last row
    expect(results[0][3][0]).toBe(4)
    expect(results[1][0][3]).toBe(2) // right
    expect(results[1][3][3]).toBe(4)
    expect(results[2][0][0]).toBe(2) // up
    expect(results[2][0][3]).toBe(4)
    expect(results[3][3][0]).toBe(2) // down
    expect(results[3][3][3]).toBe(4)
  })

  it('finds the highest tile', () => {
    const board = empty()
    board[2][1] = 128
    board[0][0] = 8
    expect(highestTile(board)).toBe(128)
  })
})
