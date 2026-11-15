import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { BALLS, BUMPERS, H, LEVELS, MAX_MULTIPLIER, PIVOTS, TARGETS, UP, W, flip, flipperSeg, isOver, launch, newGame, step, type Level, type State } from './rules'

const run = (s: State, ms: number, chunk = 16) => {
  for (let t = 0; t < ms; t += chunk) s = step(s, chunk)
  return s
}
const playing = (o: Partial<State> = {}, level: Level = 'normal'): State => ({ ...launch(newGame('t', level)), ...o })

describe('launching', () => {
  it('starts ready in the lane and a launch sends the ball up', () => {
    const s = newGame('t')
    expect(s.status).toBe('ready')
    expect(s.ballsLeft).toBe(BALLS)
    const l = launch(s)
    expect(l.status).toBe('playing')
    expect(l.ball.vy).toBeLessThan(-800)
    expect(launch(l)).toBe(l)
  })
  it('is deterministic for a seed and inputs', () => {
    const go = () => {
      let s = launch(newGame('seed-a'))
      for (let i = 0; i < 400; i++) {
        s = flip(s, i % 3 === 0 ? 0 : 1, i % 2 === 0)
        s = step(s, 16)
      }
      return s
    }
    expect(go()).toEqual(go())
  })
  it('different seeds give different launch strength', () => {
    expect(launch(newGame('a')).ball.vy).not.toBe(launch(newGame('b')).ball.vy)
  })
})

describe('physics', () => {
  it('gravity pulls the ball down, and harder on the hard level', () => {
    const fall = (level: Level) => {
      const s = playing({ ball: { x: 137, y: 150, vx: 0, vy: 0 } }, level)
      return run({ ...s, ball: { x: 137, y: 40, vx: 0, vy: 0 } }, 200).ball.vy
    }
    expect(fall('normal')).toBeGreaterThan(50)
    expect(fall('hard')).toBeGreaterThan(fall('easy'))
    expect(LEVELS.hard.flipper).toBeLessThan(LEVELS.easy.flipper)
  })
  it('walls keep the ball on the table over a long random game', () => {
    const rnd = createRandom('walls')
    let s = launch(newGame('walls'))
    for (let i = 0; i < 4000 && !isOver(s); i++) {
      s = flip(s, rnd() < 0.5 ? 0 : 1, rnd() < 0.5)
      if (s.status === 'ready') s = launch(s)
      s = step(s, 16)
      expect(s.ball.x).toBeGreaterThan(-1)
      expect(s.ball.x).toBeLessThan(W + 1)
      expect(s.ball.y).toBeGreaterThan(-8)
      expect(s.ball.y).toBeLessThan(H + 25)
      expect(Number.isFinite(s.ball.vx + s.ball.vy)).toBe(true)
    }
  })
  it('a bumper bounces the ball away and scores', () => {
    const b = BUMPERS[0]
    const s = playing({ ball: { x: b.x - 30, y: b.y, vx: 300, vy: 0 } })
    let r = s
    for (let i = 0; i < 100 && r.bumps === 0; i++) r = step(r, 4)
    expect(r.bumps).toBe(1)
    expect(r.score).toBeGreaterThanOrEqual(100)
    expect(r.ball.vx).toBeLessThan(0)
  })
  it('lighting all three targets raises the multiplier and pays a bonus, capped at the maximum', () => {
    let s = playing({ ball: { x: 0, y: 0, vx: 0, vy: 0 } })
    for (const t of TARGETS) {
      s = { ...s, ball: { x: t.x, y: t.y - 14, vx: 0, vy: 60 } }
      s = run(s, 120, 4)
    }
    expect(s.multiplier).toBe(2)
    expect(s.score).toBeGreaterThanOrEqual(150 + 500)
    expect(s.lit).toEqual([false, false, false])
    const capped = { ...s, multiplier: MAX_MULTIPLIER, lit: [true, true, false] as [boolean, boolean, boolean], ball: { x: TARGETS[2].x, y: TARGETS[2].y - 14, vx: 0, vy: 60 } }
    expect(run(capped, 120, 4).multiplier).toBe(MAX_MULTIPLIER)
  })
  it('the multiplier scales bumper points', () => {
    const b = BUMPERS[1]
    const s = playing({ multiplier: 3, ball: { x: b.x + 30, y: b.y, vx: -300, vy: 0 } })
    expect(run(s, 150, 4).score).toBeGreaterThanOrEqual(300)
  })
  it('a raised flipper kicks a resting ball upward', () => {
    const seg = flipperSeg({ angle: [UP, UP], level: 'normal' }, 0)
    expect(seg[3]).toBeLessThan(PIVOTS[0].y)
    const rest = flipperSeg(newGame('t'), 0)
    // Put the ball on the resting flipper, then flip.
    let s = playing({ ball: { x: (rest[0] + rest[2]) / 2, y: (rest[1] + rest[3]) / 2 - 14, vx: 0, vy: 0 } })
    s = run(s, 120, 4)
    s = flip(s, 0, true)
    let minVy = 0
    for (let i = 0; i < 40; i++) {
      s = step(s, 4)
      minVy = Math.min(minVy, s.ball.vy)
    }
    expect(minVy).toBeLessThan(-150)
  })
})

describe('balls and game over', () => {
  it('with no input the balls drain and the game ends after three', () => {
    let s = newGame('drain')
    let drains = 0
    for (let i = 0; i < 60_000 && !isOver(s); i++) {
      if (s.status === 'ready') s = launch(s)
      const before = s.ballsLeft
      s = step(s, 16)
      if (s.ballsLeft < before) drains++
    }
    expect(isOver(s)).toBe(true)
    expect(drains).toBe(BALLS)
    expect(s.ballsLeft).toBe(0)
    expect(step(s, 100)).toBe(s)
    expect(flip(s, 0, true)).toBe(s)
  })
  it('a drain resets the multiplier and returns the ball to the lane', () => {
    const s = playing({ multiplier: 4, ball: { x: 137, y: H + 30, vx: 0, vy: 100 } })
    const r = step(s, 16)
    expect(r.status).toBe('ready')
    expect(r.ballsLeft).toBe(BALLS - 1)
    expect(r.multiplier).toBe(1)
    expect(r.ball.x).toBeGreaterThan(W - 26)
  })
  it('flippers only move while the game is not over', () => {
    const r = flip(newGame('t'), 1, true)
    expect(r.held[1]).toBe(true)
    expect(flip(r, 1, true)).toBe(r)
  })
})
