/**
 * Pure Carve rules (a rectangle-division puzzle). Split the grid into rectangles so that every rectangle
 * contains exactly one number and its area equals that number. No React or browser APIs.
 */
import type { Random } from '../../lib/rng'

export type Size = 5 | 7 | 9
export const SIZES: readonly Size[] = [5, 7, 9]

/** Inclusive corners. */
export type Rect = { r0: number; c0: number; r1: number; c1: number }
export type Puzzle = { size: Size; numbers: Record<number, number>; solution: Rect[] }
export type CarveState = { puzzle: Puzzle; rects: Rect[]; status: 'playing' | 'won' }

export const area = (r: Rect) => (r.r1 - r.r0 + 1) * (r.c1 - r.c0 + 1)
export const normalise = (a: number, b: number, size: number): Rect => ({
  r0: Math.min(Math.floor(a / size), Math.floor(b / size)),
  r1: Math.max(Math.floor(a / size), Math.floor(b / size)),
  c0: Math.min(a % size, b % size),
  c1: Math.max(a % size, b % size),
})
export const cellsOf = (r: Rect, size: number): number[] => {
  const out: number[] = []
  for (let y = r.r0; y <= r.r1; y++) for (let x = r.c0; x <= r.c1; x++) out.push(y * size + x)
  return out
}
const overlap = (a: Rect, b: Rect) => a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1

/** Splits the whole grid into random rectangles, then puts each rectangle's area on a random cell inside it. */
export function newPuzzle(size: Size, random: Random): Puzzle {
  const maxArea = size === 5 ? 4 : size === 7 ? 6 : 7
  let rects: Rect[] = [{ r0: 0, c0: 0, r1: size - 1, c1: size - 1 }]
  const split = (r: Rect): Rect[] => {
    const h = r.r1 - r.r0 + 1
    const w = r.c1 - r.c0 + 1
    const vertical = w > 1 && (h === 1 || random() < w / (w + h))
    if (vertical) {
      const at = r.c0 + 1 + Math.floor(random() * (w - 1))
      return [{ ...r, c1: at - 1 }, { ...r, c0: at }]
    }
    const at = r.r0 + 1 + Math.floor(random() * (h - 1))
    return [{ ...r, r1: at - 1 }, { ...r, r0: at }]
  }
  for (;;) {
    const next: Rect[] = []
    let changed = false
    for (const r of rects) {
      if (area(r) > 1 && (area(r) > maxArea || random() < 0.3)) {
        next.push(...split(r))
        changed = true
      } else next.push(r)
    }
    rects = next
    if (!changed) break
    if (rects.every((r) => area(r) <= maxArea)) break
  }
  const numbers: Record<number, number> = {}
  for (const r of rects) {
    const cells = cellsOf(r, size)
    numbers[cells[Math.floor(random() * cells.length)]] = area(r)
  }
  return { size, numbers, solution: rects }
}

export const newGame = (size: Size, random: Random): CarveState => ({ puzzle: newPuzzle(size, random), rects: [], status: 'playing' })

/** Numbers inside a rectangle. */
const inside = (p: Puzzle, r: Rect) => cellsOf(r, p.size).filter((c) => p.numbers[c] !== undefined)

/** A rectangle is right when it holds exactly one number and its area equals it. */
export const isRight = (p: Puzzle, r: Rect): boolean => {
  const found = inside(p, r)
  return found.length === 1 && p.numbers[found[0]] === area(r)
}

export function isSolved(p: Puzzle, rects: readonly Rect[]): boolean {
  const covered = rects.reduce((n, r) => n + area(r), 0)
  return covered === p.size * p.size && rects.every((r) => isRight(p, r)) && rects.every((a, i) => rects.every((b, j) => i === j || !overlap(a, b)))
}

/** Adds a rectangle, replacing any it overlaps. */
export function place(s: CarveState, r: Rect): CarveState {
  if (s.status === 'won') return s
  const rects = [...s.rects.filter((o) => !overlap(o, r)), r]
  return { ...s, rects, status: isSolved(s.puzzle, rects) ? 'won' : 'playing' }
}

/** Removes the rectangle covering a cell, if any. */
export function remove(s: CarveState, cell: number): CarveState {
  if (s.status === 'won') return s
  const { size } = s.puzzle
  const y = Math.floor(cell / size)
  const x = cell % size
  const rects = s.rects.filter((r) => !(r.r0 <= y && y <= r.r1 && r.c0 <= x && x <= r.c1))
  return rects.length === s.rects.length ? s : { ...s, rects }
}

export const reset = (s: CarveState): CarveState => ({ ...s, rects: [], status: 'playing' })

/** 1000 minus 2 per second, never below 100. */
export const scoreFor = (seconds: number): number => Math.max(100, 1000 - Math.round(2 * seconds))
