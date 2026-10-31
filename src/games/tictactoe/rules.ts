import type { Random } from '../../lib/rng'

/** Pure Tic-Tac-Toe rules and a computer opponent. No React or browser APIs. */

export type Player = 1 | 2
export type Cell = 0 | Player
/** Player 1 (X) moves first. In single-player the human is X. */
export type TState = {
  cells: Cell[]
  turn: Player
  winner: 0 | Player
  line: number[] | null
  moves: number
  draw: boolean
}

export const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

export const other = (p: Player): Player => (p === 1 ? 2 : 1)
export const isOver = (s: TState) => s.winner !== 0 || s.draw
export const newGame = (): TState => ({ cells: Array<Cell>(9).fill(0), turn: 1, winner: 0, line: null, moves: 0, draw: false })
export const legalCells = (s: TState): number[] => (isOver(s) ? [] : s.cells.flatMap((c, i) => (c === 0 ? [i] : [])))

/** Places the current player's mark. Returns the same object when the move is illegal. */
export function play(state: TState, cell: unknown): TState {
  if (isOver(state) || typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell > 8 || state.cells[cell] !== 0) return state
  const cells = state.cells.slice()
  cells[cell] = state.turn
  const line = LINES.find((l) => l.every((i) => cells[i] === state.turn)) ?? null
  const moves = state.moves + 1
  return { cells, turn: other(state.turn), winner: line ? state.turn : 0, line, moves, draw: !line && moves === 9 }
}

/** Value for `me`: positive is a win, sooner is better. */
function search(s: TState, me: Player): number {
  if (s.winner) return (s.winner === me ? 10 : -10) * (10 - s.moves)
  if (s.draw) return 0
  let best = s.turn === me ? -Infinity : Infinity
  for (const c of legalCells(s)) {
    const v = search(play(s, c), me)
    best = s.turn === me ? Math.max(best, v) : Math.min(best, v)
  }
  return best
}

/**
 * The computer's cell. It plays perfectly except that, with probability `slip`, it plays a random legal cell, so
 * it can be beaten. Always draws exactly two numbers from `random`, so the same seed always plays the same game.
 */
export function aiMove(state: TState, random: Random = Math.random, slip = 0.2): number {
  const cells = legalCells(state)
  const roll = random()
  const pick = random()
  if (!cells.length) return -1
  if (roll < slip) return cells[Math.floor(pick * cells.length)]
  const me = state.turn
  let best = -Infinity
  let choices: number[] = []
  for (const c of cells) {
    const v = search(play(state, c), me)
    if (v > best) {
      best = v
      choices = [c]
    } else if (v === best) choices.push(c)
  }
  return choices[Math.floor(pick * choices.length)]
}

/** A win is worth more the sooner it comes; a draw is worth something; a loss nothing. */
export function scoreFor(s: TState): number {
  if (s.winner === 1) return 500 + 100 * (5 - Math.ceil(s.moves / 2))
  return s.draw ? 200 : 0
}

export function isState(v: unknown): v is TState {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Partial<TState>
  return Array.isArray(s.cells) && s.cells.length === 9 && s.cells.every((c) => c === 0 || c === 1 || c === 2) && (s.turn === 1 || s.turn === 2) && typeof s.moves === 'number' && (s.winner === 0 || s.winner === 1 || s.winner === 2) && typeof s.draw === 'boolean'
}
