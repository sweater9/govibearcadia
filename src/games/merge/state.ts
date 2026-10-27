import type { Random } from '../../lib/rng'
import { addTile, canMove, emptyBoard, move, type Board } from './logic'

export type Direction = 'left' | 'right' | 'up' | 'down'
export type MergeState = { board: Board; score: number; over: boolean }

export const newGame = (random: Random = Math.random): MergeState => ({
  board: addTile(addTile(emptyBoard(), random), random),
  score: 0,
  over: false,
})

/**
 * Pure transition. Returns the *same* state object when the move is ignored
 * (game over, or the move changed nothing) so callers can detect no-ops by identity.
 */
export function step(state: MergeState, dir: Direction, random: Random = Math.random): MergeState {
  if (state.over) return state
  const result = move(state.board, dir)
  if (!result.changed) return state
  const board = addTile(result.board, random)
  return { board, score: state.score + result.score, over: !canMove(board) }
}

export const highestTile = (board: Board): number => Math.max(...board.flat())
