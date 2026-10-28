import type { Random } from '../../lib/rng'

/** Pure Connect Four rules and a small minimax opponent. No React or browser APIs. */

export const COLS = 7
export const ROWS = 6
export type Player = 1 | 2
export type Cell = 0 | Player
/** Player 1 is the human and always moves first; player 2 is the computer. */
export type C4State = {
  /** Row-major, row 0 at the top. */
  cells: Cell[]
  turn: Player
  winner: 0 | Player
  /** Indices of the four winning cells, once someone has won. */
  line: number[] | null
  moves: number
  draw: boolean
}

export const idx = (r: number, c: number) => r * COLS + c
export const isOver = (s: C4State) => s.winner !== 0 || s.draw
export const other = (p: Player): Player => (p === 1 ? 2 : 1)

export const newGame = (): C4State => ({
  cells: Array<Cell>(COLS * ROWS).fill(0),
  turn: 1,
  winner: 0,
  line: null,
  moves: 0,
  draw: false,
})

/** Lowest empty row in a column, or -1 when the column is full. */
export function dropRow(cells: readonly Cell[], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (cells[idx(r, col)] === 0) return r
  return -1
}

export const legalCols = (s: C4State): number[] =>
  isOver(s) ? [] : Array.from({ length: COLS }, (_, c) => c).filter((c) => dropRow(s.cells, c) >= 0)

const DIRS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]]

/** The four-in-a-row that includes (r, c), if the piece there completes one. */
function lineThrough(cells: readonly Cell[], r: number, c: number): number[] | null {
  const p = cells[idx(r, c)]
  if (p === 0) return null
  for (const [dr, dc] of DIRS) {
    const run = [idx(r, c)]
    for (const sign of [1, -1]) {
      let rr = r + dr * sign
      let cc = c + dc * sign
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && cells[idx(rr, cc)] === p) {
        run.push(idx(rr, cc))
        rr += dr * sign
        cc += dc * sign
      }
    }
    if (run.length >= 4) return run.sort((a, b) => a - b).slice(0, 4)
  }
  return null
}

/** Drops the current player's piece. Returns the same object when the move is illegal. */
export function drop(state: C4State, col: number): C4State {
  if (isOver(state) || col < 0 || col >= COLS) return state
  const r = dropRow(state.cells, col)
  if (r < 0) return state
  const cells = state.cells.slice()
  cells[idx(r, col)] = state.turn
  const line = lineThrough(cells, r, col)
  const moves = state.moves + 1
  return {
    cells,
    turn: other(state.turn),
    winner: line ? state.turn : 0,
    line,
    moves,
    draw: !line && moves === COLS * ROWS,
  }
}

const WIN = 100000

/** Static evaluation from `me`'s point of view: every four-cell window, plus a centre preference. */
function evaluate(cells: readonly Cell[], me: Player): number {
  let score = 0
  for (let r = 0; r < ROWS; r++) if (cells[idx(r, 3)] === me) score += 3
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of DIRS) {
        const er = r + dr * 3
        const ec = c + dc * 3
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue
        let mine = 0
        let theirs = 0
        for (let k = 0; k < 4; k++) {
          const v = cells[idx(r + dr * k, c + dc * k)]
          if (v === me) mine++
          else if (v !== 0) theirs++
        }
        if (mine && theirs) continue
        if (mine === 3) score += 5
        else if (mine === 2) score += 2
        else if (theirs === 3) score -= 4
        else if (theirs === 2) score -= 1
      }
    }
  }
  return score
}

/** Centre columns first, which makes alpha-beta prune far more. */
const ORDER = [3, 2, 4, 1, 5, 0, 6]

function search(state: C4State, depth: number, alpha: number, beta: number, me: Player): number {
  if (state.winner) return state.winner === me ? WIN + depth : -WIN - depth
  if (state.draw) return 0
  if (depth === 0) return evaluate(state.cells, me)
  const maximizing = state.turn === me
  let best = maximizing ? -Infinity : Infinity
  for (const col of ORDER) {
    if (dropRow(state.cells, col) < 0) continue
    const value = search(drop(state, col), depth - 1, alpha, beta, me)
    if (maximizing) {
      best = Math.max(best, value)
      alpha = Math.max(alpha, best)
    } else {
      best = Math.min(best, value)
      beta = Math.min(beta, best)
    }
    if (alpha >= beta) break
  }
  return best
}

/**
 * The computer's column for the player to move. Looks `depth` plies ahead; equally good columns are
 * chosen with `random`, so the same seed always plays the same game. Returns -1 when no move exists.
 */
export function aiMove(state: C4State, random: Random = Math.random, depth = 4): number {
  const cols = legalCols(state)
  if (!cols.length) return -1
  const me = state.turn
  let best = -Infinity
  let choices: number[] = []
  for (const col of cols) {
    const value = search(drop(state, col), depth - 1, -Infinity, Infinity, me)
    if (value > best) {
      best = value
      choices = [col]
    } else if (value === best) choices.push(col)
  }
  return choices[Math.floor(random() * choices.length)]
}

/** A win is worth more the sooner it comes; a draw is worth something; a loss nothing. */
export function scoreFor(state: C4State): number {
  if (state.winner === 1) return Math.max(100, 1000 - 30 * Math.ceil(state.moves / 2))
  return state.draw ? 300 : 0
}
