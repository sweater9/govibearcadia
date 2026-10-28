import type { Random } from '../../lib/rng'

/** Pure Brick Breaker rules on a fixed-size field. No React, timers or browser APIs. All units are field units. */

export const W = 320
export const H = 420
export const COLS = 8
export const ROWS = 5
export const BRICK_W = W / COLS
export const BRICK_H = 16
export const TOP = 48
export const PADDLE_W = 64
export const PADDLE_H = 10
export const PADDLE_Y = H - 28
export const BALL_R = 6
export const PADDLE_SPEED = 380
export const LIVES = 3
/** Points per brick by row, top row first. */
export const ROW_POINTS = [50, 40, 30, 20, 10]
const MAX_BOUNCE = (60 * Math.PI) / 180
const MAX_STEP = 4

export type Status = 'ready' | 'playing' | 'lost' | 'won'
export type Ball = { x: number; y: number; vx: number; vy: number }
export type BreakerState = {
  paddleX: number
  ball: Ball
  /** Row-major, true while the brick is standing. */
  bricks: boolean[]
  lives: number
  score: number
  broken: number
  status: Status
}

export const TOTAL = COLS * ROWS
/** Ball speed grows as the wall comes down. */
export const speedFor = (broken: number): number => Math.min(380, 240 + 5 * broken)

const clampPaddle = (x: number) => Math.min(W - PADDLE_W / 2, Math.max(PADDLE_W / 2, x))
const onPaddle = (paddleX: number): Ball => ({ x: paddleX, y: PADDLE_Y - BALL_R, vx: 0, vy: 0 })

export function newGame(): BreakerState {
  return {
    paddleX: W / 2,
    ball: onPaddle(W / 2),
    bricks: Array<boolean>(TOTAL).fill(true),
    lives: LIVES,
    score: 0,
    broken: 0,
    status: 'ready',
  }
}

/** Puts the paddle's centre at x. A ball resting on the paddle goes with it. */
export function movePaddle(state: BreakerState, x: number): BreakerState {
  if (state.status === 'lost' || state.status === 'won') return state
  const paddleX = clampPaddle(x)
  if (paddleX === state.paddleX) return state
  return { ...state, paddleX, ball: state.status === 'ready' ? onPaddle(paddleX) : state.ball }
}

/** Serves the ball upward at a slightly random angle (within about 17 degrees of vertical). */
export function launch(state: BreakerState, random: Random = Math.random): BreakerState {
  if (state.status !== 'ready') return state
  const angle = (random() - 0.5) * 0.6
  const speed = speedFor(state.broken)
  return { ...state, status: 'playing', ball: { ...state.ball, vx: speed * Math.sin(angle), vy: -speed * Math.cos(angle) } }
}

/** Index of a standing brick the circle at (x, y) overlaps, or -1. */
function brickAt(bricks: readonly boolean[], x: number, y: number): number {
  const c0 = Math.max(0, Math.floor((x - BALL_R) / BRICK_W))
  const c1 = Math.min(COLS - 1, Math.floor((x + BALL_R) / BRICK_W))
  const r0 = Math.max(0, Math.floor((y - BALL_R - TOP) / BRICK_H))
  const r1 = Math.min(ROWS - 1, Math.floor((y + BALL_R - TOP) / BRICK_H))
  let hit = -1
  let best = Infinity
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!bricks[r * COLS + c]) continue
      const left = c * BRICK_W
      const top = TOP + r * BRICK_H
      const nx = Math.min(left + BRICK_W, Math.max(left, x))
      const ny = Math.min(top + BRICK_H, Math.max(top, y))
      const d = (x - nx) ** 2 + (y - ny) ** 2
      if (d <= BALL_R * BALL_R && d < best) {
        best = d
        hit = r * COLS + c
      }
    }
  }
  return hit
}

/**
 * Advances `dt` seconds. `dir` is the keyboard direction (-1, 0, 1) moving the paddle.
 * Long steps are split so the ball never moves more than a few units at a time.
 */
export function step(state: BreakerState, dt: number, dir: -1 | 0 | 1 = 0): BreakerState {
  if (state.status === 'lost' || state.status === 'won') return state
  let s = dir ? movePaddle(state, state.paddleX + dir * PADDLE_SPEED * dt) : state
  if (s.status !== 'playing') return s

  const speed = Math.hypot(s.ball.vx, s.ball.vy)
  const parts = Math.max(1, Math.ceil((speed * dt) / MAX_STEP))
  const h = dt / parts
  for (let i = 0; i < parts && s.status === 'playing'; i++) s = substep(s, h)
  return s
}

function substep(state: BreakerState, h: number): BreakerState {
  let { x, y, vx, vy } = state.ball
  const px = x
  const py = y
  x += vx * h
  y += vy * h

  if (x < BALL_R) {
    x = BALL_R
    vx = Math.abs(vx)
  } else if (x > W - BALL_R) {
    x = W - BALL_R
    vx = -Math.abs(vx)
  }
  if (y < BALL_R) {
    y = BALL_R
    vy = Math.abs(vy)
  }

  // Paddle: only from above, and the offset from its centre sets the outgoing angle.
  if (vy > 0 && y + BALL_R >= PADDLE_Y && py + BALL_R <= PADDLE_Y + 1 && Math.abs(x - state.paddleX) <= PADDLE_W / 2 + BALL_R) {
    const offset = Math.max(-1, Math.min(1, (x - state.paddleX) / (PADDLE_W / 2)))
    const speed = speedFor(state.broken)
    y = PADDLE_Y - BALL_R
    vx = speed * Math.sin(offset * MAX_BOUNCE)
    vy = -speed * Math.cos(offset * MAX_BOUNCE)
  }

  let { bricks, score, broken } = state
  const hit = brickAt(bricks, x, y)
  if (hit >= 0) {
    const c = hit % COLS
    const r = Math.floor(hit / COLS)
    const left = c * BRICK_W
    // Came in from the side if the previous position was already beside the brick; otherwise top or bottom.
    if (px + BALL_R <= left || px - BALL_R >= left + BRICK_W) vx = -vx
    else vy = -vy
    bricks = bricks.slice()
    bricks[hit] = false
    broken += 1
    score += ROW_POINTS[r]
    // Leave the brick so the same one cannot be hit twice.
    x = px
    y = py
  }

  if (broken === TOTAL) {
    return { ...state, ball: { x, y, vx, vy }, bricks, broken, score: score + state.lives * 100, status: 'won' }
  }

  if (y - BALL_R > H) {
    const lives = state.lives - 1
    if (lives === 0) return { ...state, ball: { x, y, vx: 0, vy: 0 }, bricks, broken, score, lives, status: 'lost' }
    return { ...state, ball: onPaddle(state.paddleX), bricks, broken, score, lives, status: 'ready' }
  }

  return { ...state, ball: { x, y, vx, vy }, bricks, broken, score }
}
