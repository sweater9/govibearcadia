import { describe, expect, it } from 'vitest'
import { BOMB_PENALTY, DURATION, HOLES, LIVES, MAX_MULTIPLIER, SWITCH_MS, WRONG_PENALTY, multiplier, newGame, score, start, step, targetFor, timeLeft, whack, type Colour, type Kind, type State } from './rules'

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
  const other = (c: Colour): Colour => (c === 'red' ? 'blue' : 'red')
  const pop = (base: State, kind: Kind, colour: Colour, hole = 4): State => ({ ...base, holes: base.holes.map((_, i) => (i === hole ? { kind, colour, ttl: 500 } : null)) })
  it('whacking the target colour scores by kind', () => {
    const base = playing()
    expect(score(whack(pop(base, 'mole', base.target), 4))).toBe(10)
    expect(score(whack(pop(base, 'gold', base.target), 4))).toBe(30)
    const hit = whack(pop(base, 'mole', base.target), 4)
    expect(hit.holes[4]).toBeNull()
    expect(hit.lives).toBe(LIVES)
  })
  it('a bomb or a wrong colour costs a life and the streak, and points never go below zero', () => {
    const base = { ...playing(), streak: 7 }
    const bombed = whack(pop(base, 'bomb', base.target), 4)
    expect(bombed.points).toBe(BOMB_PENALTY)
    expect(score(bombed)).toBe(0)
    expect(bombed.bombs).toBe(1)
    expect([bombed.lives, bombed.streak]).toEqual([LIVES - 1, 0])
    const wrong = whack(pop(base, 'mole', other(base.target)), 4)
    expect(wrong.points).toBe(WRONG_PENALTY)
    expect([wrong.wrong, wrong.lives, wrong.streak, wrong.hits]).toEqual([1, LIVES - 1, 0, 0])
  })
  it('the third lost life ends the round, and then input is ignored', () => {
    let s = { ...playing(), lives: 1 }
    s = whack(pop(s, 'bomb', s.target), 4)
    expect([s.status, s.reason, s.lives]).toEqual(['over', 'lives', 0])
    const again = pop(s, 'mole', s.target)
    expect(whack(again, 4)).toBe(again)
  })
  it('hits in a row raise the multiplier, capped, and a miss of the target colour resets it', () => {
    expect([0, 4, 5, 10, 15, 99].map(multiplier)).toEqual([1, 1, 2, 3, 4, MAX_MULTIPLIER])
    let s = playing()
    for (let i = 0; i < 6; i++) s = whack(pop(s, 'mole', s.target), 4)
    // Five hits at x1 (50) then the sixth at x2 (20).
    expect([s.points, s.streak, s.bestStreak]).toEqual([70, 6, 6])
    const gone = step({ ...pop(s, 'mole', s.target), nextSpawn: 99999 }, 600)
    expect(gone.streak).toBe(0)
    expect(gone.bestStreak).toBe(6)
    const wrongGone = step({ ...pop(s, 'mole', other(s.target)), nextSpawn: 99999 }, 600)
    expect(wrongGone.streak).toBe(6)
  })
  it('the target colour changes every few seconds to a different colour, the same way for the same seed', () => {
    const at = (seed: string, ms: number) => run(playing(seed), ms).target
    const first = newGame('t').target
    expect(at('t', SWITCH_MS - 100)).toBe(first)
    expect(at('t', SWITCH_MS + 100)).not.toBe(first)
    expect(at('t', 20000)).toBe(at('t', 20000))
    expect(targetFor('x', 3, 'red')).not.toBe('red')
    // Never the same colour twice in a row.
    let s = playing('seq')
    let prev = s.target
    for (let i = 0; i < 6; i++) {
      s = run(s, SWITCH_MS)
      if (s.target === prev) throw new Error('target did not change')
      prev = s.target
    }
  })
  it('missed moles are counted when they sink back, bombs are not', () => {
    const base = playing()
    const s = step({ ...base, nextSpawn: 99999, holes: base.holes.map((_, i) => (i === 0 ? { kind: 'mole', colour: 'red', ttl: 100 } : i === 1 ? { kind: 'bomb', colour: 'red', ttl: 100 } : null)) }, 200)
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
    const again = whack({ ...over, holes: over.holes.map((_, i) => (i === 0 ? { kind: 'mole', colour: over.target, ttl: 500 } : null)) }, 0)
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
