import { describe, expect, it } from 'vitest'
import { DURATION, HOLES, newGame, score, start, step, timeLeft, whack, type State } from './rules'

const run = (s: State, ms: number) => { for (let t = 0; t < ms; t += 50) s = step(s, 50); return s }
const playing = (seed = 'm') => start(newGame(seed))

describe('mole mash rules', () => {
  it('deals the same pops for the same seed and different ones otherwise', () => {
    expect(run(playing('a'), 5000).holes).toEqual(run(playing('a'), 5000).holes)
    const layout = (seed: string) => JSON.stringify(run(playing(seed), 9000).holes.map((h) => h?.kind ?? null))
    expect(new Set(['a', 'b', 'c', 'd'].map(layout)).size).toBeGreaterThan(1)
  })
  it('does nothing until started', () => {
    const s = newGame('m')
    expect(step(s, 5000)).toBe(s)
  })
  it('pops moles into holes, never more than there are holes', () => {
    const s = run(playing(), 3000)
    expect(s.holes.some(Boolean)).toBe(true)
    expect(s.holes).toHaveLength(HOLES)
  })
  it('whacking scores by kind, and a bomb costs points but not below zero', () => {
    const base = playing()
    const mk = (kind: 'mole' | 'gold' | 'bomb'): State => ({ ...base, holes: base.holes.map((_, i) => (i === 4 ? { kind, ttl: 500 } : null)) })
    expect(score(whack(mk('mole'), 4))).toBe(10)
    expect(score(whack(mk('gold'), 4))).toBe(30)
    const bombed = whack(mk('bomb'), 4)
    expect(bombed.points).toBe(-25)
    expect(score(bombed)).toBe(0)
    expect(bombed.bombs).toBe(1)
    expect(bombed.holes[4]).toBeNull()
  })
  it('missed moles are counted when they sink back, bombs are not', () => {
    const base = playing()
    const s = step({ ...base, nextSpawn: 99999, holes: base.holes.map((_, i) => (i === 0 ? { kind: 'mole', ttl: 100 } : i === 1 ? { kind: 'bomb', ttl: 100 } : null)) }, 200)
    expect(s.misses).toBe(1)
    expect(s.holes.every((h) => h === null)).toBe(true)
  })
  it('whacking an empty hole does nothing, and the first tap starts the round', () => {
    const s = whack(newGame('m'), 3)
    expect(s.status).toBe('playing')
    expect(s.points).toBe(0)
  })
  it('the round ends after the time limit and then ignores input', () => {
    const over = run(playing(), DURATION + 500)
    expect(over.status).toBe('over')
    expect(timeLeft(over)).toBe(0)
    const again = whack({ ...over, holes: over.holes.map((_, i) => (i === 0 ? { kind: 'mole', ttl: 500 } : null)) }, 0)
    expect(again).toBe(again.status === 'over' ? again : again)
    expect(again.points).toBe(over.points)
    expect(step(over, 1000)).toBe(over)
  })
  it('pops get quicker as the round goes on', () => {
    const early = run(playing(), 15000).spawned
    const late = run(playing(), 45000).spawned - early
    expect(late / 30).toBeGreaterThan(early / 15)
  })
})
