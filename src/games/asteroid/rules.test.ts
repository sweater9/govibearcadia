import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { BULLET_LIFE, EXTRA_LIFE, INVULN, LEVELS, NO_INPUT, POINTS, SIZE, newGame, spawnWave, start, step, type AState, type Rock } from './rules'

const rnd = () => createRandom('aa-rules')
const playing = (o: Partial<AState> = {}): AState => ({ ...start(newGame('normal')), rocks: [{ x: 5, y: 5, vx: 0, vy: 0, size: 3, spin: 0 }], ...o })
const rock = (o: Partial<Rock> = {}): Rock => ({ x: 20, y: 20, vx: 0, vy: 0, size: 3, spin: 0, ...o })

describe('ship', () => {
  it('does not move until the game starts', () => {
    const s = newGame()
    expect(step(s, 0.1, { ...NO_INPUT, thrust: true }, rnd())).toBe(s)
  })
  it('thrust accelerates in the facing direction and the ship keeps drifting', () => {
    let s = playing({ angle: Math.PI / 2 })
    for (let i = 0; i < 30; i++) s = step(s, 1 / 60, { ...NO_INPUT, thrust: true }, rnd())
    expect(s.vx).toBeGreaterThan(10)
    expect(Math.abs(s.vy)).toBeLessThan(0.01)
    const v = s.vx
    for (let i = 0; i < 30; i++) s = step(s, 1 / 60, NO_INPUT, rnd())
    expect(s.vx).toBeGreaterThan(v * 0.7)
    expect(s.x).toBeGreaterThan(50)
  })
  it('rotates and wraps around the edges', () => {
    let s = playing({ x: 99, vx: 30, rocks: [rock({ x: 50, y: 5 })] })
    s = step(s, 0.1, { ...NO_INPUT, turn: 1 }, rnd())
    expect(s.angle).toBeGreaterThan(0)
    expect(s.x).toBeLessThan(10)
    expect(s.x).toBeGreaterThanOrEqual(0)
    expect(s.x).toBeLessThan(SIZE)
  })
})

describe('shooting', () => {
  it('fires with a cooldown, at most five shots live, and bullets expire', () => {
    let s = playing({ rocks: [rock({ x: 80, y: 80 })] })
    s = step(s, 0.01, { ...NO_INPUT, fire: true }, rnd())
    expect(s.bullets).toHaveLength(1)
    s = step(s, 0.01, { ...NO_INPUT, fire: true }, rnd())
    expect(s.bullets).toHaveLength(1)
    for (let i = 0; i < 100; i++) s = step(s, 0.05, { ...NO_INPUT, fire: true }, rnd())
    expect(s.bullets.length).toBeLessThanOrEqual(5)
    const lone = step(playing({ rocks: [rock({ x: 80, y: 80 })] }), 0.01, { ...NO_INPUT, fire: true }, rnd())
    let t = lone
    for (let i = 0; i < Math.ceil(BULLET_LIFE / 0.05) + 1; i++) t = step(t, 0.05, NO_INPUT, rnd())
    expect(t.bullets).toHaveLength(0)
  })
  it('a hit splits a big rock into two smaller ones and scores', () => {
    const s = playing({ rocks: [rock({ x: 50, y: 40 })], bullets: [{ x: 50, y: 41, vx: 0, vy: -10, life: 1 }], x: 90, y: 90 })
    const r = step(s, 0.01, NO_INPUT, rnd())
    expect(r.score).toBe(POINTS[3])
    expect(r.rocks.map((k) => k.size)).toEqual([2, 2])
    expect(r.bullets).toHaveLength(0)
    expect(r.hits).toBe(1)
  })
  it('the smallest rocks just vanish', () => {
    const s = playing({ rocks: [rock({ x: 50, y: 40, size: 1 })], bullets: [{ x: 50, y: 40.5, vx: 0, vy: -10, life: 1 }], x: 90, y: 90 })
    const r = step(s, 0.01, NO_INPUT, rnd())
    expect(r.score).toBe(POINTS[1])
    expect(r.rocks).toHaveLength(0)
  })
})

describe('lives and waves', () => {
  it('a collision costs a life, respawns at the centre and grants brief invulnerability', () => {
    const s = playing({ rocks: [rock({ x: 52, y: 50 })] })
    const r = step(s, 0.01, NO_INPUT, rnd())
    expect(r.lives).toBe(LEVELS.normal.lives - 1)
    expect(r.invuln).toBeGreaterThan(INVULN - 0.1)
    expect([r.x, r.y]).toEqual([50, 50])
    const again = step(r, 0.01, NO_INPUT, rnd())
    expect(again.lives).toBe(r.lives)
  })
  it('losing the last life ends the game', () => {
    const r = step(playing({ lives: 1, rocks: [rock({ x: 52, y: 50 })] }), 0.01, NO_INPUT, rnd())
    expect(r.status).toBe('lost')
    expect(step(r, 1, NO_INPUT, rnd())).toBe(r)
  })
  it('clearing the field brings a bigger wave after a short pause', () => {
    let s = playing({ rocks: [], wave: 1, x: 90, y: 90 })
    for (let i = 0; i < 200 && s.rocks.length === 0; i++) s = step(s, 0.05, NO_INPUT, rnd())
    expect(s.wave).toBe(2)
    expect(s.rocks.length).toBe(LEVELS.normal.rocks + 2)
    expect(s.rocks.every((k) => k.size === 3)).toBe(true)
  })
  it('spawns rocks away from the ship and is deterministic for a seed', () => {
    const s = playing()
    const a = spawnWave({ ...s, wave: 3 }, createRandom('w'))
    expect(a).toEqual(spawnWave({ ...s, wave: 3 }, createRandom('w')))
    for (const k of a) expect(Math.hypot(k.x - s.x, k.y - s.y)).toBeGreaterThanOrEqual(25)
  })
  it('an extra life arrives at each 3000 points', () => {
    const s = playing({ score: EXTRA_LIFE - 20, rocks: [rock({ x: 50, y: 40 })], bullets: [{ x: 50, y: 41, vx: 0, vy: -10, life: 1 }], x: 90, y: 90 })
    expect(step(s, 0.01, NO_INPUT, rnd()).lives).toBe(LEVELS.normal.lives + 1)
  })
  it('harder levels start with more rocks and fewer lives', () => {
    expect(LEVELS.hard.rocks).toBeGreaterThan(LEVELS.easy.rocks)
    expect(LEVELS.hard.lives).toBeLessThan(LEVELS.easy.lives)
  })
})
