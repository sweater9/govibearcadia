import { shuffle, type Random } from '../../lib/rng'

/** Pure Color Sort rules: no React or browser APIs, so a server can reuse them to validate runs. */

export const COLORS = 6
export const CAPACITY = 4
export const EMPTY_TUBES = 2
export const TUBES = COLORS + EMPTY_TUBES

/** Tubes list balls from the bottom up; a ball is a color index 0..COLORS-1. */
export type Tubes = number[][]
export type Move = [from: number, to: number]
export type SortState = { tubes: Tubes; moves: Move[] }

export const canMove = (tubes: Tubes, from: number, to: number): boolean => {
  if (from === to) return false
  const src = tubes[from]
  const dst = tubes[to]
  if (!src || !dst || src.length === 0 || dst.length >= CAPACITY) return false
  return dst.length === 0 || dst[dst.length - 1] === src[src.length - 1]
}

const apply = (tubes: Tubes, from: number, to: number): Tubes =>
  tubes.map((tube, i) => (i === from ? tube.slice(0, -1) : i === to ? [...tube, tubes[from][tubes[from].length - 1]] : tube))

export const isSolved = (tubes: Tubes): boolean =>
  tubes.every((tube) => tube.length === 0 || (tube.length === CAPACITY && tube.every((b) => b === tube[0])))

/** Depth-first search with a node budget. Returns the moves of a solution, or null if none was found in budget. */
export function solve(start: Tubes, budget = 30000): Move[] | null {
  const seen = new Set<string>()
  let nodes = 0
  const key = (tubes: Tubes) => tubes.map((t) => t.join('')).sort().join('|')
  const visit = (tubes: Tubes, path: Move[]): Move[] | null => {
    if (isSolved(tubes)) return path
    if (++nodes > budget) return null
    const k = key(tubes)
    if (seen.has(k)) return null
    seen.add(k)
    const moves: Move[] = []
    for (let from = 0; from < tubes.length; from++)
      for (let to = 0; to < tubes.length; to++) if (canMove(tubes, from, to)) moves.push([from, to])
    // Prefer building on a matching ball over opening an empty tube, and skip pointless shuffles.
    moves.sort((a, b) => Number(tubes[a[1]].length === 0) - Number(tubes[b[1]].length === 0))
    for (const [from, to] of moves) {
      const src = tubes[from]
      if (tubes[to].length === 0 && src.every((b) => b === src[0])) continue // moving a pure tube to empty
      const found = visit(apply(tubes, from, to), [...path, [from, to]])
      if (found) return found
    }
    return null
  }
  return visit(start, [])
}

export const solvable = (start: Tubes, budget = 30000): boolean => solve(start, budget) !== null

/** A shuffled deal that is proven solvable, with two empty tubes. Draws only from `random`. */
export function newGame(random: Random = Math.random): SortState {
  const balls = Array.from({ length: COLORS * CAPACITY }, (_, i) => Math.floor(i / CAPACITY))
  for (;;) {
    const deck = shuffle(balls, random)
    const tubes: Tubes = Array.from({ length: TUBES }, (_, t) => (t < COLORS ? deck.slice(t * CAPACITY, (t + 1) * CAPACITY) : []))
    if (!isSolved(tubes) && solvable(tubes)) return { tubes, moves: [] }
  }
}

/** Moves one ball. Returns the same object when the move is illegal. */
export function move(state: SortState, from: number, to: number): SortState {
  if (isSolved(state.tubes) || !canMove(state.tubes, from, to)) return state
  return { tubes: apply(state.tubes, from, to), moves: [...state.moves, [from, to]] }
}

/** Takes back the last move. Returns the same object when there is nothing to undo. */
export function undo(state: SortState): SortState {
  const last = state.moves[state.moves.length - 1]
  if (!last) return state
  const [from, to] = last
  return { tubes: apply(state.tubes, to, from), moves: state.moves.slice(0, -1) }
}

/** Fewer moves score higher, never below 100. */
export const scoreFor = (state: SortState): number => Math.max(100, 1000 - 8 * state.moves.length)
