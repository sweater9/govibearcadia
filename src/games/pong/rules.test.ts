import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import {
  AI_SPEED, AI_Y, H, PADDLE_H, PADDLE_W, PLAYER_Y, W, WIN_SCORE,
  movePlayer, newGame, scoreFor, serve, speedFor, step, type PongState,
} from './rules'

const playing = (o: Partial<PongState>): PongState => ({ ...newGame(), status: 'playing', ...o })
const ball = (x: number, y: number, vx: number, vy: number) => ({ x, y, vx, vy })

describe('Neon Pong rules', () => {
  it('starts ready at 0-0 with the first serve heading toward the player', () => {
    const s = newGame()
    expect(s).toMatchObject({ status: 'ready', playerScore: 0, aiScore: 0, serveToward: 'player' })
  })

  it('serves from the centre, at a seeded angle and the opening speed, toward whoever conceded', () => {
    const a = serve(newGame(), createRandom('s'))
    expect(a.status).toBe('playing')
    expect(a.ball.vy).toBeGreaterThan(0) // toward the player at the bottom
    expect(Math.hypot(a.ball.vx, a.ball.vy)).toBeCloseTo(speedFor(0), 5)
    expect(Math.abs(Math.atan2(a.ball.vx, a.ball.vy))).toBeLessThanOrEqual(Math.PI / 6 + 1e-9)
    expect(serve(newGame(), createRandom('s'))).toEqual(a)
    expect(serve(a)).toBe(a)
    expect(serve({ ...newGame(), serveToward: 'ai' }, createRandom('s')).ball.vy).toBeLessThan(0)
  })

  it('moves and clamps the player paddle', () => {
    expect(movePlayer(newGame(), -50).playerX).toBe(PADDLE_W / 2)
    expect(movePlayer(newGame(), 999).playerX).toBe(W - PADDLE_W / 2)
  })

  it('the player paddle returns the ball and its landing spot steers the angle', () => {
    const mid = step(playing({ playerX: 160, ball: ball(160, PLAYER_Y - 8, 0, 240) }), 0.02)
    expect(mid.ball.vy).toBeLessThan(0)
    expect(Math.abs(mid.ball.vx)).toBeLessThan(1)
    expect(mid.rally).toBe(1)
    const edge = step(playing({ playerX: 160, ball: ball(160 + PADDLE_W / 2 - 2, PLAYER_Y - 8, 0, 240) }), 0.02)
    expect(edge.ball.vx).toBeGreaterThan(100)
  })

  it('the computer paddle returns the ball downward', () => {
    const s = step(playing({ aiX: 160, ball: ball(160, AI_Y + PADDLE_H + 8, 0, -240) }), 0.02)
    expect(s.ball.vy).toBeGreaterThan(0)
    expect(s.rally).toBe(1)
  })

  it('bounces off the side walls', () => {
    expect(step(playing({ ball: ball(8, 200, -200, 100) }), 0.05).ball.vx).toBeGreaterThan(0)
    expect(step(playing({ ball: ball(W - 8, 200, 200, 100) }), 0.05).ball.vx).toBeLessThan(0)
  })

  it('a ball past the player scores for the computer and the next serve comes back to the player', () => {
    const s = step(playing({ playerX: 40, ball: ball(280, H - 4, 0, 300) }), 0.1)
    expect(s.aiScore).toBe(1)
    expect(s.status).toBe('ready')
    expect(s.serveToward).toBe('player')
    expect(s.ball).toMatchObject({ x: W / 2, y: H / 2 })
  })

  it('a ball past the computer scores for the player and the next serve goes to the computer', () => {
    const s = step(playing({ aiX: 280, ball: ball(30, 4, 0, -300) }), 0.1)
    expect(s.playerScore).toBe(1)
    expect(s.serveToward).toBe('ai')
  })

  it('first to seven wins; a finished match accepts nothing', () => {
    const won = step(playing({ playerScore: WIN_SCORE - 1, aiX: 280, ball: ball(30, 4, 0, -300) }), 0.1)
    expect(won.status).toBe('won')
    expect(won.playerScore).toBe(WIN_SCORE)
    expect(step(won, 1)).toBe(won)
    expect(serve(won)).toBe(won)
    const lost = step(playing({ aiScore: WIN_SCORE - 1, playerX: 40, ball: ball(280, H - 4, 0, 300) }), 0.1)
    expect(lost.status).toBe('lost')
  })

  it('the rally speeds the ball up, to a cap, and a point resets it', () => {
    expect(speedFor(0)).toBe(220)
    expect(speedFor(5)).toBe(290)
    expect(speedFor(100)).toBe(420)
    const s = step(playing({ rally: 6, aiX: 280, ball: ball(30, 4, 0, -300) }), 0.1)
    expect(s.rally).toBe(0)
  })

  it('the computer chases at a limited speed and drifts back to the middle when the ball goes away', () => {
    const chase = step(playing({ aiX: 60, ball: ball(280, 200, 0, -1) }), 0.1)
    expect(chase.aiX).toBeCloseTo(60 + AI_SPEED * 0.1, 5)
    const away = step(playing({ aiX: 60, ball: ball(280, 200, 0, 50) }), 0.1)
    expect(away.aiX).toBeGreaterThan(60) // toward the centre
    expect(away.aiX).toBeLessThanOrEqual(160)
  })

  it('does not tunnel through a paddle at top speed in one long step', () => {
    const s = step(playing({ playerX: 160, ball: ball(160, PLAYER_Y - 60, 0, 420) }), 0.2)
    expect(s.rally).toBe(1)
    expect(s.ball.vy).toBeLessThan(0)
  })

  it('scoring: points plus a win bonus that grows with the margin', () => {
    expect(scoreFor({ ...newGame(), playerScore: 3, aiScore: 5 })).toBe(300)
    expect(scoreFor({ ...newGame(), playerScore: 7, aiScore: 0, status: 'won' })).toBe(700 + 300 + 700)
    expect(scoreFor({ ...newGame(), playerScore: 7, aiScore: 6, status: 'won' })).toBe(700 + 300 + 100)
  })

  it('a player who stays out of the way loses 7-0 quickly', () => {
    const random = createRandom('idle')
    let s = newGame()
    for (let t = 0; t < 120 * 120 && s.status !== 'lost'; t++) {
      if (s.status === 'ready') s = serve(s, random)
      s = movePlayer(s, s.ball.x < W / 2 ? W - 30 : 30)
      s = step(s, 1 / 120, 0, random)
    }
    expect(s.status).toBe('lost')
    expect(s.playerScore).toBe(0)
  })

  it('a player who tracks the ball and aims away from the computer can win (so a win is reachable)', () => {
    const random = createRandom('bot')
    let s = newGame()
    for (let t = 0; t < 120 * 60 * 10 && s.status !== 'won' && s.status !== 'lost'; t++) {
      if (s.status === 'ready') s = serve(s, random)
      const away = s.aiX < W / 2 ? 1 : -1 // hit toward the side the computer is not on
      s = movePlayer(s, s.ball.x - away * PADDLE_W * 0.4)
      s = step(s, 1 / 120, 0, random)
    }
    expect(s.status).toBe('won')
  })
})
