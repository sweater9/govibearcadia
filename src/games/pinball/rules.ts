import { createRandom } from '../../lib/rng'

/**
 * Pure pinball physics: a ball under gravity on a fixed table with walls, a launch lane, three pop bumpers, three
 * stand-up targets, two flippers and a centre drain. Stepping is fixed-timestep, so the same seed and the same inputs
 * always play out identically. No React or browser APIs.
 *
 * Units are table units (300 wide, 480 tall, y down) and seconds. Three balls per game.
 */
export const W = 300
export const H = 480
export const R = 6
export const BALLS = 3
const SUB = 1 / 240
const MAX_SPEED = 950
export const MAX_MULTIPLIER = 5

export type Level = 'easy' | 'normal' | 'hard'
export const LEVELS: Record<Level, { gravity: number; flipper: number; launch: number }> = {
  easy: { gravity: 520, flipper: 54, launch: 860 },
  normal: { gravity: 640, flipper: 48, launch: 860 },
  hard: { gravity: 780, flipper: 42, launch: 880 },
}

type Seg = readonly [number, number, number, number]
const LANE_X = W - 26
export const WALLS: readonly Seg[] = [
  [0, 0, 0, H], [0, 0, W, 0], [W, 0, W, H],
  [LANE_X, 130, LANE_X, H - 30], [LANE_X, H - 30, W, H - 30],
  [W, 70, W - 52, 0], [0, 60, 50, 0],
  [0, 385, 78, 432], [LANE_X, 385, 196, 432],
]
export const BUMPERS: readonly { x: number; y: number; r: number }[] = [{ x: 90, y: 185, r: 17 }, { x: 184, y: 185, r: 17 }, { x: 137, y: 250, r: 17 }]
export const TARGETS: readonly { x: number; y: number; r: number }[] = [{ x: 80, y: 100, r: 7 }, { x: 137, y: 100, r: 7 }, { x: 194, y: 100, r: 7 }]
export const PIVOTS = [{ x: 81, y: 430 }, { x: 193, y: 430 }] as const
export const REST = (28 * Math.PI) / 180
export const UP = (-32 * Math.PI) / 180
const FLIP_SPEED = 20
const FLIP_THICK = 4
const START = { x: W - 13, y: H - 30 - R }

export type Side = 0 | 1
export type Ball = { x: number; y: number; vx: number; vy: number }
export type State = {
  seed: string
  level: Level
  status: 'ready' | 'playing' | 'over'
  ball: Ball
  ballsLeft: number
  score: number
  multiplier: number
  maxMultiplier: number
  lit: [boolean, boolean, boolean]
  /** Milliseconds each bumper keeps flashing. */
  flash: [number, number, number]
  /** Current angle of each flipper and whether its button is held. */
  angle: [number, number]
  held: [boolean, boolean]
  /** Angular speed in radians per second, for kicking the ball. */
  spin: [number, number]
  launches: number
  bumps: number
  hits: number
  acc: number
  still: number
  /** Milliseconds of play simulated, so a paused game does not count. */
  played: number
}

export function newGame(seed = 'pinball', level: Level = 'normal'): State {
  return {
    seed, level, status: 'ready', ball: { ...START, vx: 0, vy: 0 }, ballsLeft: BALLS, score: 0, multiplier: 1, maxMultiplier: 1,
    lit: [false, false, false], flash: [0, 0, 0], angle: [REST, REST], held: [false, false], spin: [0, 0], launches: 0, bumps: 0, hits: 0, acc: 0, still: 0, played: 0,
  }
}

export const isOver = (s: State) => s.status === 'over'
export const score = (s: State) => s.score

/** Plunger: shoots the ball up the lane. The strength varies a little, the same way for a given seed. */
export function launch(s: State): State {
  if (s.status !== 'ready') return s
  const jitter = createRandom(`${s.seed}:${s.launches}`)()
  return { ...s, status: 'playing', launches: s.launches + 1, still: 0, ball: { ...s.ball, vx: 0, vy: -(LEVELS[s.level].launch + jitter * 40) } }
}

/** Presses or releases a flipper button. */
export function flip(s: State, side: Side, down: boolean): State {
  if (s.held[side] === down || s.status === 'over') return s
  const held: [boolean, boolean] = [...s.held]
  held[side] = down
  return { ...s, held }
}

/** The line a flipper currently occupies, from pivot to tip. */
export function flipperSeg(s: Pick<State, 'angle' | 'level'>, side: Side): Seg {
  const p = PIVOTS[side]
  const a = s.angle[side]
  const len = LEVELS[s.level].flipper
  const dx = Math.cos(a) * len * (side === 0 ? 1 : -1)
  return [p.x, p.y, p.x + dx, p.y + Math.sin(a) * len]
}

/** Closest point on a segment to (px, py), and how far along it (0 to 1). */
function closest(seg: Seg, px: number, py: number): { x: number; y: number; t: number } {
  const [ax, ay, bx, by] = seg
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return { x: ax + dx * t, y: ay + dy * t, t }
}

/** Pushes the ball out of a segment and bounces it. `surface` is the velocity of the surface at the contact. */
function bounce(b: Ball, seg: Seg, radius: number, e: number, surface?: (t: number, cx: number, cy: number) => [number, number]): boolean {
  const c = closest(seg, b.x, b.y)
  let nx = b.x - c.x
  let ny = b.y - c.y
  const d = Math.hypot(nx, ny)
  if (d >= radius || d === 0) return false
  nx /= d
  ny /= d
  b.x += nx * (radius - d)
  b.y += ny * (radius - d)
  const [sx, sy] = surface ? surface(c.t, c.x, c.y) : [0, 0]
  const vn = (b.vx - sx) * nx + (b.vy - sy) * ny
  if (vn < 0) {
    b.vx -= (1 + e) * vn * nx
    b.vy -= (1 + e) * vn * ny
  }
  return true
}

function circleHit(b: Ball, c: { x: number; y: number; r: number }, kick: number): boolean {
  const nx = b.x - c.x
  const ny = b.y - c.y
  const d = Math.hypot(nx, ny)
  const reach = R + c.r
  if (d >= reach || d === 0) return false
  const ux = nx / d
  const uy = ny / d
  b.x = c.x + ux * reach
  b.y = c.y + uy * reach
  const speed = Math.max(Math.hypot(b.vx, b.vy) * 0.9 + kick * 0.4, kick)
  b.vx = ux * speed
  b.vy = uy * speed
  return true
}

function drained(s: State): State {
  const ballsLeft = s.ballsLeft - 1
  const base = { ...s, ballsLeft, multiplier: 1, lit: [false, false, false] as [boolean, boolean, boolean], ball: { ...START, vx: 0, vy: 0 }, still: 0 }
  return ballsLeft <= 0 ? { ...base, status: 'over' } : { ...base, status: 'ready' }
}

/** Advances the table by `dtMs` of play. Fixed sub-steps make it deterministic. */
export function step(s: State, dtMs: number): State {
  if (s.status === 'over') return s
  let st: State = { ...s, ball: { ...s.ball }, angle: [...s.angle], spin: [...s.spin], flash: [...s.flash], lit: [...s.lit] }
  const g = LEVELS[s.level].gravity
  st.acc += dtMs / 1000
  while (st.acc >= SUB) {
    st.acc -= SUB
    // Flippers swing toward their target angle at a fixed speed.
    for (const side of [0, 1] as const) {
      const target = st.held[side] ? UP : REST
      const before = st.angle[side]
      const moved = Math.max(-FLIP_SPEED * SUB, Math.min(FLIP_SPEED * SUB, target - before))
      st.angle[side] = before + moved
      st.spin[side] = moved / SUB
    }
    st.played += SUB * 1000
    for (let i = 0; i < 3; i++) st.flash[i] = Math.max(0, st.flash[i] - SUB * 1000)
    if (st.status !== 'playing') continue
    const b = st.ball
    b.vy += g * SUB
    const sp = Math.hypot(b.vx, b.vy)
    if (sp > MAX_SPEED) {
      b.vx *= MAX_SPEED / sp
      b.vy *= MAX_SPEED / sp
    }
    b.x += b.vx * SUB
    b.y += b.vy * SUB
    for (const w of WALLS) bounce(b, w, R, 0.6)
    for (const side of [0, 1] as const) {
      const seg = flipperSeg(st, side)
      const p = PIVOTS[side]
      const w = st.spin[side]
      const a = st.angle[side]
      bounce(b, seg, R + FLIP_THICK, 0.5, (_t, cx, cy) => {
        // Surface speed at the contact: the swing's angular speed times the distance from the pivot.
        const d = Math.hypot(cx - p.x, cy - p.y)
        return side === 0 ? [-Math.sin(a) * d * w, Math.cos(a) * d * w] : [Math.sin(a) * d * w, Math.cos(a) * d * w]
      })
    }
    BUMPERS.forEach((bm, i) => {
      if (circleHit(b, bm, 320)) {
        st.flash[i] = 140
        st.score += 100 * st.multiplier
        st.bumps++
      }
    })
    TARGETS.forEach((tg, i) => {
      if (!circleHit(b, tg, 200)) return
      st.hits++
      if (!st.lit[i]) {
        st.lit[i] = true
        st.score += 50 * st.multiplier
      }
      if (st.lit.every(Boolean)) {
        st.multiplier = Math.min(MAX_MULTIPLIER, st.multiplier + 1)
        st.maxMultiplier = Math.max(st.maxMultiplier, st.multiplier)
        st.score += 500
        st.lit = [false, false, false]
      }
    })
    // A ball that has come to rest somewhere it cannot roll off gets a nudge, as a tilt would.
    const inLane = b.x > LANE_X
    st.still = Math.hypot(b.vx, b.vy) < 10 && !inLane ? st.still + SUB * 1000 : 0
    if (st.still > 2500) {
      b.vx += createRandom(`${st.seed}:${st.played | 0}`)() < 0.5 ? -140 : 140
      st.still = 0
    }
    if (b.y > H + 20) st = drained(st)
    if (st.status === 'over') break
  }
  return st
}
