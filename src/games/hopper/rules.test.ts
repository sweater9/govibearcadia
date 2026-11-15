import { describe, expect, it } from 'vitest'
import { COLS, IDLE_LIMIT, carsAt, hop, newGame, rowAt, score, start, step, type State } from './rules'

const playing = (over: Partial<State> = {}): State => ({ ...start(newGame('a')), ...over })

describe('lane hopper rules', () => {
  it('deals the same world for a seed, with safe grass at the start', () => {
    expect(rowAt('a', 7)).toEqual(rowAt('a', 7))
    expect(rowAt('a', 0).kind).toBe('grass')
    expect(rowAt('a', 1).kind).toBe('grass')
    expect(rowAt('a', 0).trees).toEqual([])
    const kinds = Array.from({ length: 80 }, (_, r) => rowAt('a', r).kind)
    expect(kinds.filter((k) => k === 'road').length).toBeGreaterThan(20)
    expect(kinds.filter((k) => k === 'grass').length).toBeGreaterThan(10)
  })
  it('cars drive in their row direction and wrap round, never leaving a row empty', () => {
    const r = Array.from({ length: 60 }, (_, i) => rowAt('a', i)).find((x) => x.kind === 'road')!
    for (let t = 0; t < 10000; t += 500) expect(carsAt(r, t).length).toBeGreaterThan(0)
    const a = carsAt(r, 0)[0].x
    const b = carsAt({ ...r, phase: r.phase }, 100).find((c) => Math.abs(c.x - a) < 2)!.x
    expect(Math.sign(b - a)).toBe(r.dir)
  })
  it('hops in four directions and keeps inside the board', () => {
    let s = hop(playing(), 'up')
    expect(s.row).toBe(1)
    expect(hop(s, 'left').col).toBe(2)
    expect(hop(s, 'right').col).toBe(4)
    s = playing({ col: 0 })
    expect(hop(s, 'left').col).toBe(0)
    s = playing({ col: COLS - 1 })
    expect(hop(s, 'right').col).toBe(COLS - 1)
    expect(hop(playing(), 'down').row).toBe(0) // cannot go behind the start
  })
  it('scores the furthest row reached, not where you stand', () => {
    let s = hop(hop(playing(), 'up'), 'up')
    s = { ...s, row: 2, best: 2 }
    const back = hop(s, 'down')
    expect(back.row).toBe(1)
    expect(score(back)).toBe(2)
  })
  it('cannot hop into a tree', () => {
    const treeRow = Array.from({ length: 80 }, (_, r) => r).find((r) => r > 1 && rowAt('a', r).kind === 'grass' && rowAt('a', r).trees.length > 0)!
    const tree = rowAt('a', treeRow).trees[0]
    const s = playing({ row: treeRow - 1, col: tree, best: treeRow - 1 })
    expect(hop(s, 'up')).toEqual(s)
  })
  it('a car in your cell kills you; a gap does not', () => {
    const roadRow = Array.from({ length: 80 }, (_, r) => r).find((r) => rowAt('a', r).kind === 'road')!
    const row = rowAt('a', roadRow)
    const cars = carsAt(row, 0)
    const hitCol = Array.from({ length: COLS }, (_, c) => c).find((c) => cars.some((k) => k.x < c + 0.8 && k.x + k.length > c + 0.2))
    if (hitCol !== undefined) {
      const dead = hop(playing({ row: roadRow - 1, col: hitCol, best: roadRow - 1 }), 'up')
      expect(dead.status).toBe('dead')
      expect(dead.cause).toBe('car')
    }
    const free = Array.from({ length: COLS }, (_, c) => c).find((c) => !cars.some((k) => k.x < c + 1 && k.x + k.length > c))
    if (free !== undefined) expect(hop(playing({ row: roadRow - 1, col: free, best: roadRow - 1 }), 'up').status).toBe('playing')
  })
  it('the eagle comes if you stop making progress, and progress resets it', () => {
    let s = playing()
    s = step(s, IDLE_LIMIT - 100)
    expect(s.status).toBe('playing')
    s = hop(s, 'up')
    expect(s.idle).toBe(0)
    expect(step(s, IDLE_LIMIT).status).toBe('dead')
    expect(step(s, IDLE_LIMIT).cause).toBe('eagle')
  })
  it('stays dead and ignores input once dead', () => {
    const dead = step(playing({ idle: IDLE_LIMIT }), 10)
    expect(hop(dead, 'up')).toBe(dead)
    expect(step(dead, 1000)).toBe(dead)
  })
  it('does nothing until started, and the first hop starts it', () => {
    const s = newGame('a')
    expect(step(s, 5000)).toBe(s)
    expect(hop(s, 'up').status).toBe('playing')
  })
})
