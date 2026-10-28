import { shuffle, type Random } from '../../lib/rng'

/** Pure Sudoku rules and a seeded generator that only deals puzzles with exactly one solution. */

export const N = 9
export const CELLS = 81
export type Difficulty = 'easy' | 'medium' | 'hard'
/** Number of given cells left in the puzzle. */
export const CLUES: Record<Difficulty, number> = { easy: 40, medium: 33, hard: 27 }
export const BASE_SCORE: Record<Difficulty, number> = { easy: 500, medium: 1000, hard: 1500 }
const ALL = 0b1111111110 // digits 1..9 as bits 1..9

const rowOf = (i: number) => Math.floor(i / N)
const colOf = (i: number) => i % N
const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3)

/** Peers of each cell: the other 20 cells sharing its row, column or box. */
export const PEERS: readonly number[][] = Array.from({ length: CELLS }, (_, i) => {
  const peers: number[] = []
  for (let j = 0; j < CELLS; j++) if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) peers.push(j)
  return peers
})

/** Bitmask of digits still possible in cell i given the other cells of the grid. */
export function candidates(grid: readonly number[], i: number): number {
  let used = 0
  for (const p of PEERS[i]) used |= 1 << grid[p]
  return ALL & ~used
}

const bits = (mask: number): number[] => {
  const out: number[] = []
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) out.push(d)
  return out
}

/** Counts solutions of a grid, stopping at `limit`. Picks the most constrained empty cell each step. */
export function countSolutions(start: readonly number[], limit = 2): number {
  const grid = start.slice()
  let count = 0
  const search = (): void => {
    let best = -1
    let bestMask = 0
    let bestN = 10
    for (let i = 0; i < CELLS; i++) {
      if (grid[i] !== 0) continue
      const mask = candidates(grid, i)
      const n = bits(mask).length
      if (n < bestN) {
        best = i
        bestMask = mask
        bestN = n
        if (n <= 1) break
      }
    }
    if (best < 0) {
      count++
      return
    }
    for (const d of bits(bestMask)) {
      grid[best] = d
      search()
      if (count >= limit) break
    }
    grid[best] = 0
  }
  // A grid that already breaks the rules has no solutions.
  for (let i = 0; i < CELLS; i++) if (grid[i] !== 0 && !(candidates(grid, i) & (1 << grid[i]))) return 0
  search()
  return count
}

/** A complete valid grid, filled by randomized backtracking. */
export function fullGrid(random: Random): number[] {
  const grid = Array<number>(CELLS).fill(0)
  const fill = (): boolean => {
    let best = -1
    let bestMask = 0
    let bestN = 10
    for (let i = 0; i < CELLS; i++) {
      if (grid[i] !== 0) continue
      const mask = candidates(grid, i)
      const n = bits(mask).length
      if (n < bestN) {
        best = i
        bestMask = mask
        bestN = n
      }
    }
    if (best < 0) return true
    for (const d of shuffle(bits(bestMask), random)) {
      grid[best] = d
      if (fill()) return true
    }
    grid[best] = 0
    return false
  }
  fill()
  return grid
}

/** Removes cells one at a time in random order, keeping the solution unique, until `clues` remain (or no more can go). */
export function makePuzzle(solution: readonly number[], clues: number, random: Random): number[] {
  const puzzle = solution.slice()
  let left = CELLS
  for (const i of shuffle(Array.from({ length: CELLS }, (_, k) => k), random)) {
    if (left <= clues) break
    const keep = puzzle[i]
    puzzle[i] = 0
    if (countSolutions(puzzle, 2) === 1) left--
    else puzzle[i] = keep
  }
  return puzzle
}

export type SudokuState = {
  difficulty: Difficulty
  /** The given cells (0 = empty). Never changes. */
  puzzle: number[]
  solution: number[]
  /** The grid as the player sees it, givens included. */
  cells: number[]
  /** Pencil marks as a bitmask per cell. */
  notes: number[]
  /** Wrong digits placed so far. */
  mistakes: number
  status: 'playing' | 'won'
}

export function newGame(random: Random, difficulty: Difficulty = 'medium'): SudokuState {
  const solution = fullGrid(random)
  const puzzle = makePuzzle(solution, CLUES[difficulty], random)
  return { difficulty, puzzle, solution, cells: puzzle.slice(), notes: Array<number>(CELLS).fill(0), mistakes: 0, status: 'playing' }
}

export const isGiven = (s: SudokuState, i: number) => s.puzzle[i] !== 0

/** Writes a digit (1-9) into an empty or player-filled cell. Wrong digits count as mistakes. Peers lose that pencil mark. */
export function place(state: SudokuState, i: number, d: number): SudokuState {
  if (state.status === 'won' || isGiven(state, i) || d < 1 || d > 9 || state.cells[i] === d) return state
  const cells = state.cells.slice()
  cells[i] = d
  const notes = state.notes.slice()
  notes[i] = 0
  for (const p of PEERS[i]) notes[p] &= ~(1 << d)
  const mistakes = state.mistakes + (d === state.solution[i] ? 0 : 1)
  const won = cells.every((v, k) => v === state.solution[k])
  return { ...state, cells, notes, mistakes, status: won ? 'won' : 'playing' }
}

/** Toggles a pencil mark in an empty cell. */
export function toggleNote(state: SudokuState, i: number, d: number): SudokuState {
  if (state.status === 'won' || state.cells[i] !== 0 || d < 1 || d > 9) return state
  const notes = state.notes.slice()
  notes[i] ^= 1 << d
  return { ...state, notes }
}

/** Clears a player-filled cell and its pencil marks. */
export function erase(state: SudokuState, i: number): SudokuState {
  if (state.status === 'won' || isGiven(state, i) || (state.cells[i] === 0 && state.notes[i] === 0)) return state
  const cells = state.cells.slice()
  const notes = state.notes.slice()
  cells[i] = 0
  notes[i] = 0
  return { ...state, cells, notes }
}

/** Cells whose digit also appears among their peers. */
export function conflicts(cells: readonly number[]): Set<number> {
  const bad = new Set<number>()
  for (let i = 0; i < CELLS; i++) {
    if (cells[i] === 0) continue
    for (const p of PEERS[i]) {
      if (cells[p] === cells[i]) {
        bad.add(i)
        bad.add(p)
      }
    }
  }
  return bad
}

export const noteDigits = bits

/** Harder puzzles are worth more; time and mistakes take points off, never below 100. */
export const scoreFor = (state: SudokuState, seconds: number): number =>
  Math.max(100, BASE_SCORE[state.difficulty] - Math.floor(seconds / 3) - 50 * state.mistakes)
