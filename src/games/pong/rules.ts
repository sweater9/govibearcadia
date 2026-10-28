import type { Random } from '../../lib/rng'

/** Pure Neon Pong rules against a computer opponent. No React, timers or browser APIs. Field units. */

export const W = 320
export const H = 420
export const PADDLE_W = 60
export const PADDLE_H = 10
/** Paddle top edges: the computer at the top, the player at the bottom. */
export const AI_Y = 20
export const PLAYER_Y = H - 30
export const BALL_R = 6
export const PLAYER_SPEED = 380
export const AI_SPEED = 200
export const WIN_SCORE = 7
const MAX_BOUNCE = (55 * Math.PI) / 180
const MAX_STEP = 4

export type Side = 'player' | 'ai'
export type Status = 'ready' | 'playing' | 'won' | 'lost'
export type Ball = { x: number; y: number; vx: number; vy: number }
export type PongState = {
  playerX: number
  aiX: number
  ball: Ball
  playerScore: number
  aiScore: number
  /** Paddle hits since the last serve. */
  rally: number
  longest: number
  /** Who the next serve heads toward: the side that just conceded (the player at the start). */
  serveToward: Side
  /** Where on its paddle the computer is aiming to meet the ball, redrawn on every player hit. */
  aiOffset: number
  status: Status
}

/** Ball speed rises with every hit in a rally, to a cap. */
export const speedFor = (rally: number): number => Math.min(420, 220 + 14 * rally)

const clampX = (x: number) => Math.min(W - PADDLE_W / 2, Math.max(PADDLE_W / 2, x))
const centre = (): Ball => ({ x: W / 2, y: H / 2, vx: 0, vy: 0 })

export function newGame(): PongState {
  return {
    playerX: W / 2,
    aiX: W / 2,
    ball: centre(),
    playerScore: 0,
    aiScore: 0,
    rally: 0,
    longest: 0,
    serveToward: 'player',
    aiOffset: 0,
    status: 'ready',
  }
}

export function movePlayer(state: PongState, x: number): PongState {
  if (state.status === 'won' || state.status === 'lost') return state
  const playerX = clampX(x)
  return playerX === state.playerX ? state : { ...state, playerX }
}

/** Serves from the centre, at a seeded angle within 30 degrees of straight up or down. */
export function serve(state: PongState, random: Random = Math.random): PongState {
  if (state.status !== 'ready') return state
  const angle = (random() - 0.5) * (Math.PI / 3)
  const speed = speedFor(0)
  const down = state.serveToward === 'player' ? 1 : -1
  return { ...state, status: 'playing', ball: { x: W / 2, y: H / 2, vx: speed * Math.sin(angle), vy: down * speed * Math.cos(angle) } }
}

/** Score for the run: points won, plus a bonus for winning that grows with the margin. */
export const scoreFor = (state: PongState): number =>
  state.playerScore * 100 + (state.status === 'won' ? 300 + (WIN_SCORE - state.aiScore) * 100 : 0)

/**
 * Advances `dt` seconds. `dir` is the keyboard direction for the player's paddle. `random` is drawn from
 * only when the player returns the ball (to vary where the computer aims), so a seeded stream gives a
 * repeatable match for repeatable input.
 */
export function step(state: PongState, dt: number, dir: -1 | 0 | 1 = 0, random: Random = Math.random): PongState {
  if (state.status === 'won' || state.status === 'lost') return state
  let s = dir ? movePlayer(state, state.playerX + dir * PLAYER_SPEED * dt) : state
  s = moveAi(s, dt)
  if (s.status !== 'playing') return s

  const speed = Math.hypot(s.ball.vx, s.ball.vy)
  const parts = Math.max(1, Math.ceil((speed * dt) / MAX_STEP))
  const h = dt / parts
  for (let i = 0; i < parts && s.status === 'playing'; i++) s = substep(s, h, random)
  return s
}

/** The computer chases the ball while it is coming its way, and drifts back to the middle otherwise. */
function moveAi(state: PongState, dt: number): PongState {
  const heading = state.status === 'playing' && state.ball.vy < 0
  const target = clampX(heading ? state.ball.x + state.aiOffset : W / 2)
  const gap = target - state.aiX
  const move = Math.max(-AI_SPEED * dt, Math.min(AI_SPEED * dt, gap))
  return move === 0 ? state : { ...state, aiX: state.aiX + move }
}

function substep(state: PongState, h: number, random: Random): PongState {
  let { x, y, vx, vy } = state.ball
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

  let { rally, longest, aiOffset } = state
  const bounce = (paddleX: number, upward: boolean) => {
    rally += 1
    longest = Math.max(longest, rally)
    const offset = Math.max(-1, Math.min(1, (x - paddleX) / (PADDLE_W / 2)))
    const speed = speedFor(rally)
    vx = speed * Math.sin(offset * MAX_BOUNCE)
    vy = (upward ? -1 : 1) * speed * Math.cos(offset * MAX_BOUNCE)
  }

  // Player paddle (bottom): hit from above.
  if (vy > 0 && y + BALL_R >= PLAYER_Y && py + BALL_R <= PLAYER_Y + 1 && Math.abs(x - state.playerX) <= PADDLE_W / 2 + BALL_R) {
    y = PLAYER_Y - BALL_R
    bounce(state.playerX, true)
    // The computer will try to meet the ball somewhere along its paddle, not always dead centre.
    aiOffset = (random() - 0.5) * PADDLE_W * 0.9
  }
  // Computer paddle (top): hit from below.
  const aiBottom = AI_Y + PADDLE_H
  if (vy < 0 && y - BALL_R <= aiBottom && py - BALL_R >= aiBottom - 1 && Math.abs(x - state.aiX) <= PADDLE_W / 2 + BALL_R) {
    y = aiBottom + BALL_R
    bounce(state.aiX, false)
  }

  const next = { ...state, ball: { x, y, vx, vy }, rally, longest, aiOffset }
  if (y - BALL_R > H) return point(next, 'ai')
  if (y + BALL_R < 0) return point(next, 'player')
  return next
}

function point(state: PongState, winner: Side): PongState {
  const playerScore = state.playerScore + (winner === 'player' ? 1 : 0)
  const aiScore = state.aiScore + (winner === 'ai' ? 1 : 0)
  const status: Status = playerScore >= WIN_SCORE ? 'won' : aiScore >= WIN_SCORE ? 'lost' : 'ready'
  return {
    ...state,
    playerScore,
    aiScore,
    rally: 0,
    aiOffset: 0,
    serveToward: winner === 'ai' ? 'player' : 'ai',
    ball: centre(),
    status,
  }
}
