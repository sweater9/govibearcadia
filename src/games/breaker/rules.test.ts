import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import {
  BALL_R, BRICK_H, BRICK_W, COLS, H, LIVES, PADDLE_W, PADDLE_Y, ROWS, ROW_POINTS, TOP, TOTAL, W,
  launch, movePaddle, newGame, speedFor, step, type BreakerState,
} from './rules'

const playing = (over: Partial<BreakerState> & { ball: BreakerState['ball'] }): BreakerState => ({ ...newGame(), status: 'playing', ...over })
const run = (s: BreakerState, seconds: number, dir: -1 | 0 | 1 = 0) => {
  for (let t = 0; t < seconds * 120 && s.status === 'playing'; t++) s = step(s, 1 / 120, dir)
  return s
}

describe('Brick Breaker rules', () => {
  it('starts ready, with the ball resting on the paddle and a full wall', () => {
    const s = newGame()
    expect(s.status).toBe('ready')
    expect(s.bricks).toHaveLength(TOTAL)
    expect(s.bricks.every(Boolean)).toBe(true)
    expect(s.lives).toBe(LIVES)
    expect(s.ball).toMatchObject({ x: W / 2, y: PADDLE_Y - BALL_R })
  })

  it('moves and clamps the paddle; a resting ball goes with it', () => {
    const s = movePaddle(newGame(), 10)
    expect(s.paddleX).toBe(PADDLE_W / 2)
    expect(s.ball.x).toBe(PADDLE_W / 2)
    expect(movePaddle(s, 9999).paddleX).toBe(W - PADDLE_W / 2)
    expect(movePaddle(s, s.paddleX)).toBe(s)
  })

  it('launches upward within about 17 degrees of vertical, at the right speed, deterministically', () => {
    const a = launch(newGame(), createRandom('l'))
    expect(a.status).toBe('playing')
    expect(a.ball.vy).toBeLessThan(0)
    expect(Math.hypot(a.ball.vx, a.ball.vy)).toBeCloseTo(speedFor(0), 5)
    expect(Math.abs(Math.atan2(a.ball.vx, -a.ball.vy))).toBeLessThanOrEqual(0.31)
    expect(launch(newGame(), createRandom('l'))).toEqual(a)
    expect(launch(a)).toBe(a)
  })

  it('bounces off the side walls and the ceiling', () => {
    const left = step(playing({ ball: { x: 8, y: 300, vx: -200, vy: 0 } }), 0.05)
    expect(left.ball.vx).toBeGreaterThan(0)
    const right = step(playing({ ball: { x: W - 8, y: 300, vx: 200, vy: 0 } }), 0.05)
    expect(right.ball.vx).toBeLessThan(0)
    const top = step(playing({ ball: { x: 160, y: 8, vx: 0, vy: -200 }, bricks: Array(TOTAL).fill(false).fill(true, 0, 1) }), 0.05)
    expect(top.ball.vy).toBeGreaterThan(0)
  })

  it('the paddle returns the ball, and where it lands steers the angle', () => {
    const centre = step(playing({ paddleX: 160, ball: { x: 160, y: PADDLE_Y - BALL_R - 2, vx: 0, vy: 240 } }), 0.02)
    expect(centre.ball.vy).toBeLessThan(0)
    expect(Math.abs(centre.ball.vx)).toBeLessThan(1)
    const edge = step(playing({ paddleX: 160, ball: { x: 160 + PADDLE_W / 2 - 2, y: PADDLE_Y - BALL_R - 2, vx: 0, vy: 240 } }), 0.02)
    expect(edge.ball.vx).toBeGreaterThan(100)
    const leftEdge = step(playing({ paddleX: 160, ball: { x: 160 - PADDLE_W / 2 + 2, y: PADDLE_Y - BALL_R - 2, vx: 0, vy: 240 } }), 0.02)
    expect(leftEdge.ball.vx).toBeLessThan(-100)
  })

  it('breaking a brick scores its row value, removes it, and reverses the ball', () => {
    // Under the bottom row, heading up into brick (row 4, col 3).
    const y = TOP + ROWS * BRICK_H + BALL_R + 1
    const s = step(playing({ ball: { x: 3 * BRICK_W + 20, y, vx: 0, vy: -240 } }), 0.02)
    expect(s.broken).toBe(1)
    expect(s.score).toBe(ROW_POINTS[ROWS - 1])
    expect(s.bricks[(ROWS - 1) * COLS + 3]).toBe(false)
    expect(s.ball.vy).toBeGreaterThan(0)
  })

  it('a hit from the side flips the horizontal direction', () => {
    const bricks = Array<boolean>(TOTAL).fill(false)
    bricks[2 * COLS + 4] = true
    const left = 4 * BRICK_W
    const s = step(playing({ bricks, ball: { x: left - BALL_R - 1, y: TOP + 2 * BRICK_H + 8, vx: 240, vy: 0 } }), 0.02)
    expect(s.broken).toBe(1)
    expect(s.ball.vx).toBeLessThan(0)
  })

  it('does not tunnel through bricks at the top speed, even with a long step', () => {
    const bricks = Array<boolean>(TOTAL).fill(false)
    bricks[4 * COLS + 2] = true
    bricks[0] = true // keep the game from ending on the first break
    const s = step(playing({ bricks, ball: { x: 2 * BRICK_W + 20, y: TOP + 5 * BRICK_H + 40, vx: 0, vy: -380 } }), 0.2)
    expect(s.bricks[4 * COLS + 2]).toBe(false)
  })

  it('losing the ball costs a life and re-serves from the paddle; the last life ends the game', () => {
    const missed = step(playing({ paddleX: 40, ball: { x: 280, y: H - 2, vx: 0, vy: 300 } }), 0.1)
    expect(missed.lives).toBe(LIVES - 1)
    expect(missed.status).toBe('ready')
    expect(missed.ball).toMatchObject({ x: 40, y: PADDLE_Y - BALL_R })
    const dead = step(playing({ lives: 1, paddleX: 40, ball: { x: 280, y: H - 2, vx: 0, vy: 300 } }), 0.1)
    expect(dead.status).toBe('lost')
    expect(step(dead, 1)).toBe(dead)
    expect(launch(dead)).toBe(dead)
  })

  it('clearing the last brick wins and adds a bonus per remaining life', () => {
    const bricks = Array<boolean>(TOTAL).fill(false)
    bricks[(ROWS - 1) * COLS + 3] = true
    const y = TOP + ROWS * BRICK_H + BALL_R + 1
    const s = step(playing({ bricks, broken: TOTAL - 1, score: 1000, lives: 2, ball: { x: 3 * BRICK_W + 20, y, vx: 0, vy: -240 } }), 0.02)
    expect(s.status).toBe('won')
    expect(s.score).toBe(1000 + ROW_POINTS[ROWS - 1] + 200)
  })

  it('speeds up as bricks fall, to a cap', () => {
    expect(speedFor(0)).toBe(240)
    expect(speedFor(10)).toBe(290)
    expect(speedFor(TOTAL)).toBe(380)
  })

  it('keyboard direction moves the paddle at a steady speed, also while waiting to serve', () => {
    const s = step(newGame(), 0.1, -1)
    expect(s.paddleX).toBeCloseTo(W / 2 - 38, 5)
    expect(s.ball.x).toBe(s.paddleX)
  })

  it('left alone, the ball is eventually lost (three lives, then the game ends)', () => {
    const random = createRandom('idle')
    let s = newGame()
    for (let i = 0; i < 3000 && s.status !== 'lost'; i++) {
      if (s.status === 'ready') s = launch(s, random)
      s = step(s, 1 / 60)
    }
    expect(s.status).toBe('lost')
    expect(s.lives).toBe(0)
  })

  it('a simple tracking bot can clear the whole board (so a win is reachable)', () => {
    const random = createRandom('bot')
    let s = newGame()
    let t = 0
    while (s.status !== 'won' && s.status !== 'lost' && t++ < 60 * 60 * 15) {
      if (s.status === 'ready') s = launch(s, random)
      // Follow the ball, aiming off-centre toward the nearest standing brick column to vary angles.
      const target = s.bricks.findIndex(Boolean)
      const aim = target >= 0 ? ((target % COLS) * BRICK_W + BRICK_W / 2 - W / 2) / W : 0
      s = movePaddle(s, s.ball.x - aim * 40)
      s = step(s, 1 / 120)
    }
    expect(s.status).toBe('won')
    expect(s.broken).toBe(TOTAL)
    expect(s.score).toBeGreaterThan(ROW_POINTS.reduce((a, b) => a + b, 0) * COLS)
  })

  it('idle stepping with no input is stable for a ball at rest', () => {
    const s = newGame()
    expect(step(s, 1)).toBe(s)
    expect(run(s, 1)).toBe(s)
  })
})
