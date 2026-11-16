import { createRandom } from '../../lib/rng'

/**
 * Pure, deterministic rules and physics for Marble Maze: a marble rolls through a generated maze as the board is
 * tilted. Walls bounce it, holes send it back to the last checkpoint (with a time penalty), the goal ends the run.
 * No React or browser APIs. Time moves only through `step`, so a run is exactly repeatable.
 *
 * Units: one maze cell is CELL wide. Cell (c, r) has its centre at ((c + .5) * CELL, (r + .5) * CELL).
 */
export type Level = 'easy' | 'normal' | 'hard'
export const LEVELS: Record<Level, { label: string; cols: number; rows: number; holes: number; parPerCell: number; bonus: number }> = {
  easy: { label: 'Easy', cols: 6, rows: 6, holes: 2, parPerCell: 1.8, bonus: 0 },
  normal: { label: 'Normal', cols: 8, rows: 8, holes: 4, parPerCell: 1.5, bonus: 200 },
  hard: { label: 'Hard', cols: 10, rows: 10, holes: 7, parPerCell: 1.3, bonus: 400 },
}

export const CELL = 10
/** Wall thickness, centred on the cell boundary. */
export const WALL = 1
export const MARBLE_R = 2
/** The marble falls when its centre is this close to a hole's centre; the hole is drawn a little larger. */
export const HOLE_CATCH = 1.1
export const HOLE_DRAW = 2.3
export const GOAL_CATCH = 2.6
export const CHECK_CATCH = 3
/** Seconds added to the time for each fall. */
export const FALL_PENALTY = 3

const ACCEL = 70
const FRICTION = 1.4
const MAX_SPEED = 45
const RESTITUTION = 0.35

export type Tilt = { x: number; y: number }
export const NO_TILT: Tilt = { x: 0, y: 0 }
export type Cell = { c: number; r: number }
export type Status = 'ready' | 'playing' | 'won'

export type MState = {
  level: Level
  cols: number
  rows: number
  /** Wall above row r at column c: index r * cols + c, for r in 0..rows. */
  h: boolean[]
  /** Wall left of column c in row r: index r * (cols + 1) + c, for c in 0..cols. */
  v: boolean[]
  start: Cell
  goal: Cell
  checkpoints: Cell[]
  holes: Cell[]
  /** Cells from start to goal. */
  path: Cell[]
  x: number
  y: number
  vx: number
  vy: number
  /** Index of the last checkpoint reached, or -1 for the start. */
  cp: number
  falls: number
  /** Playing time in seconds, not counting paused time or fall penalties. */
  t: number
  status: Status
  /** Par time in seconds. */
  par: number
}

export const centre = (cell: Cell): { x: number; y: number } => ({ x: (cell.c + 0.5) * CELL, y: (cell.r + 0.5) * CELL })
const same = (a: Cell, b: Cell) => a.c === b.c && a.r === b.r

/** Is there an opening between this cell and its neighbour in direction d (0 up, 1 right, 2 down, 3 left)? */
export function open(s: Pick<MState, 'cols' | 'rows' | 'h' | 'v'>, cell: Cell, d: number): boolean {
  const { c, r } = cell
  if (d === 0) return r > 0 && !s.h[r * s.cols + c]
  if (d === 2) return r < s.rows - 1 && !s.h[(r + 1) * s.cols + c]
  if (d === 3) return c > 0 && !s.v[r * (s.cols + 1) + c]
  return c < s.cols - 1 && !s.v[r * (s.cols + 1) + c + 1]
}
export const DIR: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0]]

/** Shortest cell path between two cells by breadth-first search (the maze is a tree, so it is the only simple path). */
export function pathBetween(s: Pick<MState, 'cols' | 'rows' | 'h' | 'v'>, from: Cell, to: Cell): Cell[] | null {
  const key = (k: Cell) => k.r * s.cols + k.c
  const prev = new Map<number, Cell | null>([[key(from), null]])
  const queue: Cell[] = [from]
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]
    if (same(cur, to)) {
      const out: Cell[] = []
      for (let k: Cell | null = cur; k; k = prev.get(key(k)) ?? null) out.push(k)
      return out.reverse()
    }
    for (let d = 0; d < 4; d++) {
      if (!open(s, cur, d)) continue
      const n = { c: cur.c + DIR[d][0], r: cur.r + DIR[d][1] }
      if (prev.has(key(n))) continue
      prev.set(key(n), cur)
      queue.push(n)
    }
  }
  return null
}

/**
 * For a hole on the route at index i, a side (0 up, 1 right, 2 down, 3 left) where there is a wall in this cell and the
 * one before it, so the marble can run along it and pass the hole with room to spare. Null if there is none.
 */
export function holeSide(s: Pick<MState, 'cols' | 'rows' | 'h' | 'v' | 'path'>, i: number): number | null {
  if (i < 1 || i >= s.path.length - 1) return null
  const a = s.path[i - 1]
  const b = s.path[i]
  const d = DIR.findIndex((q) => q[0] === b.c - a.c && q[1] === b.r - a.r)
  for (const p of [(d + 1) % 4, (d + 3) % 4]) if (!open(s, b, p) && !open(s, a, p)) return p
  return null
}

/** Recursive-backtracker maze: every cell reachable, exactly one route between any two cells. */
function carve(cols: number, rows: number, random: () => number) {
  const h = Array<boolean>((rows + 1) * cols).fill(true)
  const v = Array<boolean>(rows * (cols + 1)).fill(true)
  const seen = new Set<number>([0])
  const stack: Cell[] = [{ c: 0, r: 0 }]
  while (stack.length) {
    const cur = stack[stack.length - 1]
    const options: number[] = []
    for (let d = 0; d < 4; d++) {
      const c = cur.c + DIR[d][0]
      const r = cur.r + DIR[d][1]
      if (c >= 0 && r >= 0 && c < cols && r < rows && !seen.has(r * cols + c)) options.push(d)
    }
    if (!options.length) {
      stack.pop()
      continue
    }
    const d = options[Math.floor(random() * options.length)]
    const n = { c: cur.c + DIR[d][0], r: cur.r + DIR[d][1] }
    if (d === 0) h[cur.r * cols + cur.c] = false
    else if (d === 2) h[n.r * cols + n.c] = false
    else if (d === 3) v[cur.r * (cols + 1) + cur.c] = false
    else v[cur.r * (cols + 1) + n.c] = false
    seen.add(n.r * cols + n.c)
    stack.push(n)
  }
  return { h, v }
}

/** A fresh maze for a level and seed. The same seed always gives the same maze. */
export function newGame(level: Level = 'normal', seed = 'marble'): MState {
  const { cols, rows, holes: holeCount, parPerCell } = LEVELS[level]
  const random = createRandom(`${seed}:${level}`)
  const { h, v } = carve(cols, rows, random)
  const frame = { cols, rows, h, v }
  const start: Cell = { c: 0, r: 0 }
  // The goal is the cell furthest from the start along the maze.
  let goal = start
  let far = -1
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const p = pathBetween(frame, start, { c, r })!
      if (p.length > far) {
        far = p.length
        goal = { c, r }
      }
    }
  const path = pathBetween(frame, start, goal)!
  const at = (f: number) => path[Math.min(path.length - 2, Math.max(1, Math.floor(path.length * f)))]
  const checkpoints = path.length >= 6 ? [at(1 / 3), at(2 / 3)] : []
  // Holes go on straight stretches of the route and in side branches, never at a turn, and never where the marble
  // spawns. A hole can always be passed along a wall with room to spare (HOLE_CATCH is well under the corridor slack).
  const onPath = new Map(path.map((p, i) => [p.r * cols + p.c, i]))
  const turnAt = (i: number) => i > 0 && i < path.length - 1 && (path[i - 1].c !== path[i + 1].c && path[i - 1].r !== path[i + 1].r)
  const blocked = new Set([start, goal, ...checkpoints].flatMap((k) => [k.r * cols + k.c]))
  const frameP = { ...frame, path }
  const candidates: Cell[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c
      const i = onPath.get(k)
      if (blocked.has(k)) continue
      // A hole on the route needs a straight run-up: no turn in this cell or the one before it.
      if (i !== undefined && (turnAt(i) || turnAt(i - 1) || holeSide(frameP, i) === null || Math.abs(c - start.c) + Math.abs(r - start.r) < 2)) continue
      // Not right next to a checkpoint or the goal, so arrivals are not ambushed.
      if ([...checkpoints, goal].some((q) => Math.abs(q.c - c) + Math.abs(q.r - r) < 2)) continue
      candidates.push({ c, r })
    }
  const holes: Cell[] = []
  while (holes.length < holeCount && candidates.length) holes.push(candidates.splice(Math.floor(random() * candidates.length), 1)[0])
  const p0 = centre(start)
  return {
    level, cols, rows, h, v, start, goal, checkpoints, holes, path,
    x: p0.x, y: p0.y, vx: 0, vy: 0, cp: -1, falls: 0, t: 0, status: 'ready',
    par: Math.round(path.length * parPerCell * 10) / 10,
  }
}

export const start = (s: MState): MState => (s.status === 'ready' ? { ...s, status: 'playing' } : s)
export const elapsed = (s: MState) => s.t + s.falls * FALL_PENALTY

type Rect = { x0: number; y0: number; x1: number; y1: number }
/** Wall rectangles around a point: the walls of the cells within one cell of it. */
function wallsNear(s: MState, x: number, y: number): Rect[] {
  const out: Rect[] = []
  const c0 = Math.max(0, Math.floor(x / CELL) - 1)
  const c1 = Math.min(s.cols, Math.floor(x / CELL) + 2)
  const r0 = Math.max(0, Math.floor(y / CELL) - 1)
  const r1 = Math.min(s.rows, Math.floor(y / CELL) + 2)
  const half = WALL / 2
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      if (c < s.cols && r <= s.rows && s.h[r * s.cols + c]) out.push({ x0: c * CELL - half, x1: (c + 1) * CELL + half, y0: r * CELL - half, y1: r * CELL + half })
      if (r < s.rows && c <= s.cols && s.v[r * (s.cols + 1) + c]) out.push({ x0: c * CELL - half, x1: c * CELL + half, y0: r * CELL - half, y1: (r + 1) * CELL + half })
    }
  return out
}

/** Moves the marble out of a wall and bounces it. Mutates the plain numbers in `m`. */
function collide(m: { x: number; y: number; vx: number; vy: number }, w: Rect) {
  const px = Math.min(Math.max(m.x, w.x0), w.x1)
  const py = Math.min(Math.max(m.y, w.y0), w.y1)
  let dx = m.x - px
  let dy = m.y - py
  const d2 = dx * dx + dy * dy
  if (d2 >= MARBLE_R * MARBLE_R) return
  let nx: number
  let ny: number
  let push: number
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2)
    nx = dx / d
    ny = dy / d
    push = MARBLE_R - d
  } else {
    // The centre is inside the wall: leave by the nearest face.
    dx = Math.min(m.x - w.x0, w.x1 - m.x)
    dy = Math.min(m.y - w.y0, w.y1 - m.y)
    if (dx < dy) {
      nx = m.x - w.x0 < w.x1 - m.x ? -1 : 1
      ny = 0
      push = dx + MARBLE_R
    } else {
      nx = 0
      ny = m.y - w.y0 < w.y1 - m.y ? -1 : 1
      push = dy + MARBLE_R
    }
  }
  m.x += nx * push
  m.y += ny * push
  const vn = m.vx * nx + m.vy * ny
  if (vn < 0) {
    m.vx -= (1 + RESTITUTION) * vn * nx
    m.vy -= (1 + RESTITUTION) * vn * ny
  }
}

const near = (ax: number, ay: number, b: Cell, r: number) => {
  const p = centre(b)
  return (ax - p.x) ** 2 + (ay - p.y) ** 2 < r * r
}

/** Advances the game by `dt` seconds (use a small fixed step, such as 1/120) under the given tilt, each axis -1 to 1. */
export function step(s: MState, dt: number, tilt: Tilt): MState {
  if (s.status !== 'playing') return s
  const len = Math.hypot(tilt.x, tilt.y)
  const k = len > 1 ? 1 / len : 1
  const m = { x: s.x, y: s.y, vx: s.vx, vy: s.vy }
  m.vx += tilt.x * k * ACCEL * dt
  m.vy += tilt.y * k * ACCEL * dt
  const damp = Math.max(0, 1 - FRICTION * dt)
  m.vx *= damp
  m.vy *= damp
  const sp = Math.hypot(m.vx, m.vy)
  if (sp > MAX_SPEED) {
    m.vx *= MAX_SPEED / sp
    m.vy *= MAX_SPEED / sp
  }
  m.x += m.vx * dt
  m.y += m.vy * dt
  for (let pass = 0; pass < 2; pass++) for (const w of wallsNear(s, m.x, m.y)) collide(m, w)

  const next: MState = { ...s, ...m, t: s.t + dt }
  if (near(m.x, m.y, s.goal, GOAL_CATCH)) {
    const g = centre(s.goal)
    return { ...next, x: g.x, y: g.y, vx: 0, vy: 0, status: 'won' }
  }
  for (const h of s.holes)
    if (near(m.x, m.y, h, HOLE_CATCH)) {
      const back = centre(s.cp >= 0 ? s.checkpoints[s.cp] : s.start)
      return { ...next, x: back.x, y: back.y, vx: 0, vy: 0, falls: s.falls + 1 }
    }
  for (let i = s.cp + 1; i < s.checkpoints.length; i++) if (near(m.x, m.y, s.checkpoints[i], CHECK_CATCH)) return { ...next, cp: i }
  return next
}

/** 1500 minus 500 per par-time taken, kept between 50 and 1500, plus a bonus for the harder mazes. Zero until won. */
export function scoreFor(s: MState): number {
  if (s.status !== 'won') return 0
  return Math.min(1500, Math.max(50, Math.round(1500 - (500 * elapsed(s)) / s.par))) + LEVELS[s.level].bonus
}
