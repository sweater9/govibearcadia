import { describe, expect, it } from 'vitest'
import { FIELD, PERFECT, START_WIDTH, drop, floors, newGame, score, speedAt, start, step, type State } from './rules'

const playing = (s = newGame('a')) => start(s)
const at = (s: State, x: number): State => ({ ...s, cur: { ...s.cur, x } })

describe('stack rules', () => {
  it('starts on a centred base, waits to start, and the first drop starts it', () => {
    const s = newGame('a')
    expect(s.status).toBe('ready')
    expect(s.stack).toEqual([{ x: (FIELD - START_WIDTH) / 2, w: START_WIDTH }])
    expect(step(s, 1000)).toBe(s)
    expect(drop(s).status).toBe('playing')
  })
  it('slides and bounces between the walls', () => {
    let s = playing()
    for (let i = 0; i < 400; i++) { s = step(s, 16); expect(s.cur.x).toBeGreaterThanOrEqual(-1e-9); expect(s.cur.x + s.cur.w).toBeLessThanOrEqual(FIELD + 1e-9) }
  })
  it('a perfect drop keeps the full width and counts', () => {
    const s = playing()
    const next = drop(at(s, s.stack[0].x + PERFECT / 2))
    expect(next.stack[1]).toEqual(s.stack[0])
    expect(next.perfects).toBe(1)
    expect(next.last).toBe('perfect')
  })
  it('an off-centre drop trims the overhang', () => {
    const s = playing()
    const next = drop(at(s, s.stack[0].x + 10))
    expect(next.stack[1].w).toBeCloseTo(START_WIDTH - 10)
    expect(next.stack[1].x).toBeCloseTo(s.stack[0].x + 10)
    expect(next.last).toBe('good')
    expect(floors(next)).toBe(1)
  })
  it('missing the stack ends the game, which then ignores input', () => {
    const s = playing()
    const over = drop(at(s, 0 - 0 + 0 * 1 + (s.stack[0].x - START_WIDTH - 5)))
    expect(over.status).toBe('over')
    expect(drop(over)).toBe(over)
    expect(step(over, 1000)).toBe(over)
  })
  it('three perfect drops in a row give width back, up to the starting width', () => {
    let s = playing()
    s = drop(at(s, s.stack[0].x + 10)) // trim first
    const w1 = s.stack[1].w
    for (let i = 0; i < 3; i++) s = drop(at(s, s.stack[s.stack.length - 1].x))
    expect(s.stack[s.stack.length - 1].w).toBeGreaterThan(w1)
    expect(s.stack[s.stack.length - 1].w).toBeLessThanOrEqual(START_WIDTH)
  })
  it('speeds up with height, to a cap, and scores floors plus perfects', () => {
    expect(speedAt(0)).toBeLessThan(speedAt(10))
    expect(speedAt(1000)).toBe(95)
    const s = { ...newGame('a'), stack: Array.from({ length: 6 }, () => ({ x: 30, w: 30 })), perfects: 2 }
    expect(score(s)).toBe(5 * 10 + 2 * 5)
  })
  it('is deterministic for a seed', () => {
    const run = () => { let s = playing(newGame('same')); for (let i = 0; i < 50; i++) s = step(s, 16); return drop(s) }
    expect(run()).toEqual(run())
  })
})
