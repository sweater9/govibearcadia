import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { candidates, chooseShot, LEVELS } from './ai'
import { aimDir, angleFor, MAX_ANGLE, newMatch } from './rules'

describe('aim geometry', () => {
  it('angleFor inverts aimDir for every seat', () => {
    for (const seat of [0, 1, 2, 3])
      for (const a of [-1, -0.3, 0, 0.5, 1]) {
        const d = aimDir(seat, a)
        expect(angleFor(seat, d.x, d.y)).toBeCloseTo(a, 6)
      }
  })
})

describe('computer opponent', () => {
  it('finds a plan to pocket a lone coin, and aims it at a pocket', () => {
    const s = newMatch()
    for (const c of s.coins) c.pocketed = true
    const w = s.coins.find((c) => c.kind === 'white')!
    w.pocketed = false
    w.x = 330
    w.y = 330
    const list = candidates(s, 0)
    expect(list.length).toBeGreaterThan(0)
    expect(list[0].score).toBeLessThan(0)
  })
  it('falls back to a plain shot when nothing can be pocketed', () => {
    const s = newMatch()
    expect(chooseShot(s, 0, 'hard', createRandom('f')).power).toBeGreaterThan(0)
  })
  it('always returns an aim inside the allowed range, at every level and seat', () => {
    const s = newMatch({ players: 4 })
    for (const level of LEVELS)
      for (const seat of [0, 1, 2, 3]) {
        const a = chooseShot(s, seat, level, createRandom(`${level}${seat}`))
        expect(Math.abs(a.t)).toBeLessThanOrEqual(1)
        expect(Math.abs(a.angle)).toBeLessThanOrEqual(MAX_ANGLE)
        expect(a.power).toBeGreaterThan(0)
        expect(a.power).toBeLessThanOrEqual(1)
      }
  })
  it('is deterministic for a seed', () => {
    const s = newMatch()
    expect(chooseShot(s, 0, 'medium', createRandom('x'))).toEqual(chooseShot(s, 0, 'medium', createRandom('x')))
  })
})
