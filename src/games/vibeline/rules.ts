/**
 * Pure VibeLine rules (a "zip" puzzle): draw one continuous line that starts at 1, passes through
 * the numbers in order, ends on the highest number and covers every cell exactly once.
 * No React or browser APIs.
 */
import type { Random } from '../../lib/rng'

export type Size = 4 | 5 | 6
export const SIZES: readonly Size[] = [4, 5, 6]

export type Puzzle = {
  size: Size
  /** cell index -> number on it (1..count) */
  numbers: Record<number, number>
  count: number
  /** One valid full path (cell indices), kept so tests and hints can check solvability. */
  solution: number[]
}

export type VibeState = {
  puzzle: Puzzle
  /** Cells the line passes through, in order. Starts on cell 1. */
  path: number[]
  status: 'playing' | 'won'
}

const neighbours = (size: number, i: number): number[] => {
  const x = i % size
  const y = Math.floor(i / size)
  const out: number[] = []
  if (y > 0) out.push(i - size)
  if (x < size - 1) out.push(i + 1)
  if (y < size - 1) out.push(i + size)
  if (x > 0) out.push(i - 1)
  return out
}

export const adjacent = (size: number, a: number, b: number) => neighbours(size, a).includes(b)

/** A random Hamiltonian path by randomised depth-first search with a node budget; a snake is the fallback. */
function hamiltonianPath(size: number, random: Random): number[] {
  const total = size * size
  const visited = new Array<boolean>(total).fill(false)
  const path: number[] = []
  let budget = 20000
  const go = (cell: number): boolean => {
    visited[cell] = true
    path.push(cell)
    if (path.length === total) return true
    if (--budget > 0) {
      const next = neighbours(size, cell)
        .filter((n) => !visited[n])
        .map((n) => ({ n, free: neighbours(size, n).filter((m) => !visited[m]).length, r: random() }))
        // Prefer cells with few free neighbours (Warnsdorff) so dead ends are found early; ties are random.
        .sort((a, b) => a.free - b.free || a.r - b.r)
      for (const { n } of next) if (go(n)) return true
    }
    visited[cell] = false
    path.pop()
    return false
  }
  if (go(Math.floor(random() * total))) return path
  // Fallback (never expected on these sizes): a row-by-row snake, randomly mirrored.
  const flip = random() < 0.5
  const snake: number[] = []
  for (let y = 0; y < size; y++)
    for (let k = 0; k < size; k++) snake.push(y * size + (y % 2 === 0 ? k : size - 1 - k))
  return flip ? snake.map((c) => (c % size) + Math.floor(c / size) * size).reverse() : snake
}

/** A random puzzle. Always solvable, because the numbers are laid along a real full path. */
export function newPuzzle(size: Size, random: Random): Puzzle {
  const solution = hamiltonianPath(size, random)
  const count = size + 2
  const total = size * size
  // Numbers are spread along the path, first and last always numbered, with a little jitter.
  const picks = new Set<number>([0, total - 1])
  for (let k = 1; k < count - 1; k++) {
    const base = Math.round((k * (total - 1)) / (count - 1))
    picks.add(Math.min(total - 2, Math.max(1, base + Math.floor(random() * 3) - 1)))
  }
  const ordered = [...picks].sort((a, b) => a - b)
  const numbers: Record<number, number> = {}
  ordered.forEach((p, i) => (numbers[solution[p]] = i + 1))
  return { size, numbers, count: ordered.length, solution }
}

export const startCell = (p: Puzzle): number => Number(Object.keys(p.numbers).find((c) => p.numbers[Number(c)] === 1))

export function newGame(size: Size, random: Random): VibeState {
  const puzzle = newPuzzle(size, random)
  return { puzzle, path: [startCell(puzzle)], status: 'playing' }
}

/** The highest number the line has reached so far. */
export const reached = (s: VibeState): number => s.path.reduce((m, c) => Math.max(m, s.puzzle.numbers[c] ?? 0), 0)

/**
 * Moves the head of the line to `cell`. Allowed: an unvisited neighbour that is either unnumbered or the next number
 * in order. Stepping back onto the previous cell erases the last step. Nothing else changes the state.
 */
export function step(s: VibeState, cell: number): VibeState {
  if (s.status === 'won') return s
  const { size, numbers, count } = s.puzzle
  const head = s.path[s.path.length - 1]
  if (s.path.length > 1 && cell === s.path[s.path.length - 2]) return { ...s, path: s.path.slice(0, -1) }
  if (!adjacent(size, head, cell) || s.path.includes(cell)) return s
  if (numbers[head] === count) return s // the line ends on the last number
  const n = numbers[cell]
  if (n !== undefined && n !== reached(s) + 1) return s
  const path = [...s.path, cell]
  const won = path.length === size * size && n === count
  return { ...s, path, status: won ? 'won' : 'playing' }
}

/** Walks a line across cells by dragging: applies `step` along a straight-ish run of cells. */
export function stepThrough(s: VibeState, cells: number[]): VibeState {
  return cells.reduce((acc, c) => step(acc, c), s)
}

export const undo = (s: VibeState): VibeState => (s.status === 'playing' && s.path.length > 1 ? { ...s, path: s.path.slice(0, -1) } : s)
export const reset = (s: VibeState): VibeState => ({ ...s, path: [startCell(s.puzzle)], status: 'playing' })

/** 1000 minus 4 per second, never below 100. */
export const scoreFor = (seconds: number): number => Math.max(100, 1000 - Math.round(4 * seconds))
