/**
 * Pure Twofold rules (a binary-fill puzzle). Fill the grid with two symbols so that:
 * no symbol appears three times in a row, in any row or column, and every row and column has equal numbers of each.
 * No React or browser APIs.
 */
import type { Random } from '../../lib/rng'
import { shuffle } from '../../lib/rng'

export type Mark = -1 | 0 | 1 // -1 empty, 0 and 1 the two symbols
export type Size = 4 | 6 | 8
export const SIZES: readonly Size[] = [4, 6, 8]

export type Puzzle = { size: Size; given: Mark[]; solution: Mark[] }
export type TwofoldState = { puzzle: Puzzle; cells: Mark[]; status: 'playing' | 'won' }

/** Cells that break a rule right now (only checks what can be checked on a partial grid). */
export function conflicts(size: number, cells: readonly Mark[]): Set<number> {
  const bad = new Set<number>()
  const line = (idx: number[]) => {
    for (let k = 0; k + 2 < idx.length; k++) {
      const a = cells[idx[k]]
      if (a !== -1 && a === cells[idx[k + 1]] && a === cells[idx[k + 2]]) idx.slice(k, k + 3).forEach((i) => bad.add(i))
    }
    for (const v of [0, 1] as const) if (idx.filter((i) => cells[i] === v).length > size / 2) idx.forEach((i) => cells[i] === v && bad.add(i))
  }
  for (let r = 0; r < size; r++) line(Array.from({ length: size }, (_, c) => r * size + c))
  for (let c = 0; c < size; c++) line(Array.from({ length: size }, (_, r) => r * size + c))
  return bad
}

/** True if placing `v` at `i` breaks no rule. */
function fits(size: number, cells: Mark[], i: number, v: 0 | 1): boolean {
  cells[i] = v
  const ok = !conflicts(size, cells).has(i)
  cells[i] = -1
  return ok
}

/** Counts solutions, stopping at `limit`. Fills the first empty cell with each symbol in turn. */
export function countSolutions(size: number, start: readonly Mark[], limit = 2): number {
  const cells = [...start]
  let found = 0
  const go = (): void => {
    if (found >= limit) return
    const i = cells.indexOf(-1)
    if (i === -1) {
      if (conflicts(size, cells).size === 0) found++
      return
    }
    for (const v of [0, 1] as const) {
      if (fits(size, cells, i, v)) {
        cells[i] = v
        go()
        cells[i] = -1
      }
    }
  }
  go()
  return found
}

function fullGrid(size: number, random: Random): Mark[] {
  const cells = new Array<Mark>(size * size).fill(-1)
  const go = (i: number): boolean => {
    if (i === cells.length) return true
    for (const v of shuffle([0, 1] as const, random)) {
      if (fits(size, cells, i, v)) {
        cells[i] = v
        if (go(i + 1)) return true
        cells[i] = -1
      }
    }
    return false
  }
  go(0)
  return cells
}

/** Removes cells in random order while the solution stays unique, until about `keep` remain. */
export function newPuzzle(size: Size, random: Random): Puzzle {
  const solution = fullGrid(size, random)
  const given = [...solution]
  const keep = Math.round(size * size * (size === 4 ? 0.45 : size === 6 ? 0.38 : 0.34))
  let left = given.length
  for (const i of shuffle(Array.from({ length: given.length }, (_, k) => k), random)) {
    if (left <= keep) break
    const was = given[i]
    given[i] = -1
    if (countSolutions(size, given) === 1) left--
    else given[i] = was
  }
  return { size, given, solution }
}

export const newGame = (size: Size, random: Random): TwofoldState => {
  const puzzle = newPuzzle(size, random)
  return { puzzle, cells: [...puzzle.given], status: 'playing' }
}

const isWon = (cells: readonly Mark[], size: number) => !cells.includes(-1) && conflicts(size, cells).size === 0

/** Cycles a cell: empty, symbol 0, symbol 1, empty. Given cells never change. */
export function cycle(s: TwofoldState, i: number): TwofoldState {
  if (s.status === 'won' || s.puzzle.given[i] !== -1) return s
  const cells = [...s.cells]
  cells[i] = (cells[i] === -1 ? 0 : cells[i] === 0 ? 1 : -1) as Mark
  return { ...s, cells, status: isWon(cells, s.puzzle.size) ? 'won' : 'playing' }
}

export const reset = (s: TwofoldState): TwofoldState => ({ ...s, cells: [...s.puzzle.given], status: 'playing' })

/** 1000 minus 3 per second, never below 100. */
export const scoreFor = (seconds: number): number => Math.max(100, 1000 - Math.round(3 * seconds))
