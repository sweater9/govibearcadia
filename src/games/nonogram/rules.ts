import { createRandom, type Random } from '../../lib/rng'

/** 0 blank, 1 filled, 2 marked as empty (a note for the player, ignored when checking). */
export type Cell = 0 | 1 | 2
export type Grid = Cell[][]
export type Puzzle = { size: number; solution: boolean[][]; rows: number[][]; cols: number[][] }

export const SIZES = [5, 8, 10] as const

/** Run lengths of filled cells in a line; `[0]` for an empty line. */
export function clue(line: readonly boolean[]): number[] {
  const out: number[] = []
  let run = 0
  for (const on of line) {
    if (on) run++
    else if (run) { out.push(run); run = 0 }
  }
  if (run) out.push(run)
  return out.length ? out : [0]
}

const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i])

export function fromSolution(solution: boolean[][]): Puzzle {
  const size = solution.length
  return { size, solution, rows: solution.map((r) => clue(r)), cols: Array.from({ length: size }, (_, c) => clue(solution.map((r) => r[c]))) }
}

/** A seeded picture. Every row and column holds at least one filled cell so no clue is a bare zero. */
export function newPuzzle(seed: string, size = 5, random: Random = createRandom(seed)): Puzzle {
  const solution = Array.from({ length: size }, () => Array.from({ length: size }, () => random() < 0.58))
  for (let r = 0; r < size; r++) if (!solution[r].some(Boolean)) solution[r][Math.floor(random() * size)] = true
  for (let c = 0; c < size; c++) if (!solution.some((row) => row[c])) solution[Math.floor(random() * size)][c] = true
  return fromSolution(solution)
}

export const blank = (size: number): Grid => Array.from({ length: size }, () => Array.from({ length: size }, () => 0 as Cell))

export function setCell(grid: Grid, r: number, c: number, value: Cell): Grid {
  if (grid[r]?.[c] === undefined || grid[r][c] === value) return grid
  return grid.map((row, i) => (i === r ? row.map((v, j) => (j === c ? value : v)) : row))
}

const filled = (line: readonly Cell[]) => line.map((v) => v === 1)
export const rowDone = (p: Puzzle, g: Grid, r: number) => same(clue(filled(g[r])), p.rows[r])
export const colDone = (p: Puzzle, g: Grid, c: number) => same(clue(filled(g.map((row) => row[c]))), p.cols[c])

/** Solved when every row and column matches its clue; a different picture that satisfies all clues also counts. */
export const isSolved = (p: Puzzle, g: Grid) => p.rows.every((_, r) => rowDone(p, g, r)) && p.cols.every((_, c) => colDone(p, g, c))

export const filledCount = (g: Grid) => g.reduce((n, row) => n + row.filter((v) => v === 1).length, 0)
