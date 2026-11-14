import { createRandom } from '../../lib/rng'

/** The field is 100 units wide. Blocks are stacked bottom to top. */
export const FIELD = 100
export const START_WIDTH = 42
/** A drop this close to dead centre counts as perfect: it snaps into place and keeps its full width. */
export const PERFECT = 1.6
const REGROW_AFTER = 3

export type Block = { x: number; w: number }
export type Status = 'ready' | 'playing' | 'over'
export type State = {
  seed: string
  status: Status
  stack: Block[]
  /** The block sliding back and forth above the stack. */
  cur: { x: number; w: number; dir: 1 | -1 }
  perfects: number
  combo: number
  /** The last drop, for feedback: 'perfect', 'good', or null. */
  last: 'perfect' | 'good' | null
}

export const speedAt = (floors: number) => Math.min(95, 34 + floors * 2.4)
export const floors = (s: State) => s.stack.length - 1
export const score = (s: State) => floors(s) * 10 + s.perfects * 5

export function newGame(seed: string): State {
  const dir = createRandom(`${seed}:dir`)() < 0.5 ? 1 : -1
  const base: Block = { x: (FIELD - START_WIDTH) / 2, w: START_WIDTH }
  return { seed, status: 'ready', stack: [base], cur: { x: dir === 1 ? 0 : FIELD - START_WIDTH, w: START_WIDTH, dir }, perfects: 0, combo: 0, last: null }
}

export const start = (s: State): State => (s.status === 'ready' ? { ...s, status: 'playing' } : s)

/** Slide the moving block, bouncing off the walls. */
export function step(s: State, ms: number): State {
  if (s.status !== 'playing') return s
  let { x, dir } = s.cur
  let travel = (speedAt(floors(s)) * ms) / 1000
  while (travel > 0) {
    const room = dir === 1 ? FIELD - s.cur.w - x : x
    if (travel <= room) { x += dir * travel; travel = 0 } else { x += dir * room; travel -= room; dir = (dir === 1 ? -1 : 1) }
  }
  return { ...s, cur: { ...s.cur, x, dir } }
}

/** Drop the moving block onto the stack: whatever overhangs is cut off; no overlap ends the game. */
export function drop(s: State): State {
  if (s.status === 'ready') return start(s)
  if (s.status !== 'playing') return s
  const top = s.stack[s.stack.length - 1]
  const { x, w } = s.cur
  const dx = x - top.x
  let landed: Block
  let perfect = false
  if (Math.abs(dx) <= PERFECT) { landed = { x: top.x, w: top.w }; perfect = true }
  else {
    const left = Math.max(x, top.x)
    const right = Math.min(x + w, top.x + top.w)
    if (right - left <= 0.5) return { ...s, status: 'over', last: null }
    landed = { x: left, w: right - left }
  }
  const combo = perfect ? s.combo + 1 : 0
  // Three perfect drops in a row give a little width back.
  if (perfect && combo >= REGROW_AFTER) landed = { x: Math.max(0, landed.x - 1), w: Math.min(START_WIDTH, landed.w + 2) }
  const stack = [...s.stack, landed]
  const dir: 1 | -1 = stack.length % 2 === 0 ? -1 : 1
  return { ...s, stack, perfects: s.perfects + (perfect ? 1 : 0), combo, last: perfect ? 'perfect' : 'good', cur: { x: dir === 1 ? 0 : FIELD - landed.w, w: landed.w, dir } }
}
