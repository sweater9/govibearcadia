import { describe, expect, it } from 'vitest'
import { LANES, dealRow, move, newGame, score, speedAt, start, step, type State } from './rules'

const run = (s: State, ms: number) => step(start(s), ms)

describe('traffic rules', () => {
  it('waits to start, and only drives once started', () => {
    const s = newGame('a')
    expect(step(s, 1000)).toBe(s)
    expect(run(s, 1000).distance).toBeGreaterThan(0)
  })
  it('keeps the player inside the lanes', () => {
    let s = newGame('a')
    for (let i = 0; i < 10; i++) s = move(s, -1)
    expect(s.lane).toBe(0)
    for (let i = 0; i < 10; i++) s = move(s, 1)
    expect(s.lane).toBe(LANES - 1)
  })
  it('deals the same traffic for a seed, and never fills every lane', () => {
    expect(dealRow('x', 3)).toEqual(dealRow('x', 3))
    for (let row = 0; row < 200; row++) {
      const lanes = dealRow('x', row)
      expect(new Set(lanes).size).toBe(lanes.length)
      expect(lanes.length).toBeLessThan(LANES)
    }
  })
  it('is deterministic: the same seed and inputs give the same run', () => {
    expect(run(newGame('same'), 6000)).toEqual(run(newGame('same'), 6000))
  })
  it('speeds up as you go, up to a cap', () => {
    expect(speedAt(0)).toBeLessThan(speedAt(500))
    expect(speedAt(1e9)).toBe(95)
  })
  it('crashes when a car reaches the player in the same lane', () => {
    const s: State = { ...start(newGame('a')), cars: [{ id: 1, lane: 1, y: 70 }] }
    expect(step(s, 200).status).toBe('crashed')
  })
  it('does not crash into a car in another lane, and counts it as passed', () => {
    const s: State = { ...start(newGame('a')), cars: [{ id: 1, lane: 3, y: 70 }], sinceSpawn: 0 }
    const after = step(s, 1500)
    expect(after.passed).toBeGreaterThanOrEqual(1)
  })
  it('a crashed game stays crashed and cannot move', () => {
    const s: State = { ...start(newGame('a')), cars: [{ id: 1, lane: 1, y: 80 }] }
    const dead = step(s, 100)
    expect(dead.status).toBe('crashed')
    expect(step(dead, 1000)).toBe(dead)
    expect(move(dead, 1)).toBe(dead)
  })
  it('scores distance plus ten per car passed', () => {
    expect(score({ ...newGame('a'), distance: 120.9, passed: 4 })).toBe(160)
  })
  it('a driver who dodges every car can keep going (traffic is always passable)', () => {
    let s = start(newGame('dodge'))
    for (let i = 0; i < 4000 && s.status === 'playing'; i++) {
      const danger = s.cars.filter((c) => c.y > 25 && c.y < 90).map((c) => c.lane)
      if (danger.includes(s.lane)) {
        const free = [...Array(LANES).keys()].filter((l) => !danger.includes(l)).sort((a, b) => Math.abs(a - s.lane) - Math.abs(b - s.lane))[0]
        if (free !== undefined) s = { ...s, lane: free }
      }
      s = step(s, 16)
    }
    expect(s.status).toBe('playing')
    expect(s.passed).toBeGreaterThan(20)
  })
})
