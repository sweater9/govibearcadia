import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { MILLS, NEIGHBOURS, aiPly, apply, flying, inMill, isOver, isState, legalPlies, menLeft, newGame, phase, play, removable, scoreFor, type Cell, type MState } from './rules'

const place = (s: MState, to: number) => apply(s, { type: 'place', to })
const withCells = (spec: Record<number, Cell>, over: Partial<MState> = {}): MState => {
  const s = newGame()
  for (const [k, v] of Object.entries(spec)) s.cells[Number(k)] = v
  return { ...s, ...over }
}

describe('board', () => {
  it('has 24 points, 16 mills and the right number of neighbours', () => {
    expect(NEIGHBOURS).toHaveLength(24)
    expect(MILLS).toHaveLength(16)
    for (const [p, n] of NEIGHBOURS.entries()) {
      expect(n.length).toBe(p % 2 === 0 ? 2 : p % 8 === 1 || [3, 5, 7].includes(p % 8) ? (Math.floor(p / 8) === 1 ? 4 : 3) : 2)
      for (const q of n) expect(NEIGHBOURS[q]).toContain(p)
    }
    expect(MILLS.every((m) => new Set(m).size === 3)).toBe(true)
  })
})

describe('placing', () => {
  it('alternates turns and counts men in hand', () => {
    let s = place(newGame(), 0)
    expect(s.turn).toBe(2)
    expect(s.hand).toEqual([8, 9])
    s = place(s, 1)
    expect(s.turn).toBe(1)
    expect(phase(s)).toBe('place')
  })
  it('refuses an occupied or invalid point', () => {
    const s = place(newGame(), 0)
    expect(place(s, 0)).toBe(s)
    expect(play(s, { type: 'move', to: 24 })).toBe(s)
    expect(play(s, { type: 'move', to: 1.5 })).toBe(s)
    expect(play(s, { type: 'move' })).toBe(s)
  })
  it('a mill forces a removal by the same player before the turn passes', () => {
    let s = newGame()
    for (const to of [0, 8, 1, 9]) s = place(s, to)
    s = place(s, 2)
    expect(s.removing).toBe(true)
    expect(s.turn).toBe(1)
    expect(phase(s)).toBe('remove')
    expect(place(s, 3)).toBe(s)
    const after = apply(s, { type: 'remove', at: 8 })
    expect(after.cells[8]).toBe(0)
    expect(after.turn).toBe(2)
    expect(after.removing).toBe(false)
  })
  it('cannot remove your own man or an empty point', () => {
    let s = newGame()
    for (const to of [0, 8, 1, 9, 2]) s = place(s, to)
    expect(apply(s, { type: 'remove', at: 0 })).toBe(s)
    expect(apply(s, { type: 'remove', at: 5 })).toBe(s)
  })
})

describe('removal protection', () => {
  it('protects men in a mill unless every man is in a mill', () => {
    const s = withCells({ 0: 1, 1: 1, 2: 1, 8: 2, 9: 2, 10: 2, 20: 2 }, { removing: true, hand: [0, 0] })
    expect(removable(s)).toEqual([20])
    const all = withCells({ 0: 1, 1: 1, 2: 1, 8: 2, 9: 2, 10: 2 }, { removing: true, hand: [0, 0] })
    expect(removable(all).sort((a, b) => a - b)).toEqual([8, 9, 10])
    expect(inMill(all.cells, 8)).toBe(true)
  })
})

describe('moving and flying', () => {
  const base = { hand: [0, 0] as [number, number] }
  it('slides only to an adjacent empty point', () => {
    const s = withCells({ 0: 1, 1: 1, 5: 1, 20: 1, 4: 2, 6: 2, 12: 2, 13: 2 }, base)
    expect(apply(s, { type: 'slide', from: 0, to: 7 }).cells[7]).toBe(1)
    expect(apply(s, { type: 'slide', from: 0, to: 4 })).toBe(s)
    expect(apply(s, { type: 'slide', from: 0, to: 3 })).toBe(s)
    expect(apply(s, { type: 'slide', from: 4, to: 3 })).toBe(s)
  })
  it('a player with three men flies anywhere', () => {
    const s = withCells({ 0: 1, 9: 1, 20: 1, 3: 2, 4: 2, 5: 2, 13: 2 }, base)
    expect(flying(s, 1)).toBe(true)
    expect(flying(s, 2)).toBe(false)
    expect(apply(s, { type: 'slide', from: 0, to: 22 }).cells[22]).toBe(1)
  })
  it('a slide that closes a mill asks for a removal', () => {
    const s = withCells({ 0: 1, 1: 1, 7: 1, 2: 0, 3: 1, 12: 2, 13: 2, 14: 2, 20: 2 }, base)
    const m = apply(s, { type: 'slide', from: 3, to: 2 })
    expect(m.removing).toBe(true)
  })
})

describe('winning', () => {
  it('wins by reducing the opponent below three men', () => {
    const s = withCells({ 0: 1, 1: 1, 2: 1, 8: 2, 9: 2, 20: 2 }, { removing: true, hand: [0, 0] })
    expect(apply(s, { type: 'remove', at: 20 }).winner).toBe(1)
    const t = withCells({ 0: 1, 1: 1, 2: 1, 8: 2, 9: 2 }, { removing: false, hand: [0, 0], turn: 1 })
    expect(menLeft(t, 2)).toBe(2)
    const done = apply({ ...t, removing: true, cells: t.cells.map((c, i) => (i === 10 ? 2 : c)) as Cell[] }, { type: 'remove', at: 10 })
    expect(done.winner).toBe(1)
    expect(isOver(done)).toBe(true)
    expect(legalPlies(done)).toEqual([])
  })
  it('a blocked player who has nothing left to place loses', () => {
    // Player 2's four men (0, 1, 2, 7) have every neighbouring point taken; player 1 still has a spare man to slide.
    const cells = { 0: 2, 1: 2, 2: 2, 7: 2, 3: 1, 6: 1, 9: 1, 15: 1, 5: 1 } as Record<number, Cell>
    const s = withCells(cells, { hand: [0, 0], turn: 1 })
    // Player 1 slides a spare man; player 2 then has no move.
    const next = apply(s, { type: 'slide', from: 5, to: 4 })
    expect(next.winner).toBe(1)
  })
  it('draws after a long stretch with no placement or removal', () => {
    let s = withCells({ 0: 1, 4: 1, 12: 1, 6: 2, 14: 2, 22: 2 }, { hand: [0, 0], turn: 1 })
    expect(flying(s, 1) && flying(s, 2)).toBe(true)
    const hops: [number, number][] = [[0, 3], [6, 5]]
    for (let i = 0; i < 200 && !isOver(s); i++) {
      const [a, b] = hops[i % 2]
      const [from, to] = i < 2 ? [a, b] : s.turn === 1 ? [s.cells.indexOf(1), s.cells.indexOf(0)] : [s.cells.indexOf(2), s.cells.indexOf(0)]
      const n = apply(s, { type: 'slide', from, to })
      s = n === s ? apply(s, legalPlies(s)[0]) : n
    }
    expect(isOver(s)).toBe(true)
  })
  it('scores only a player 1 win or a draw', () => {
    expect(scoreFor({ ...newGame(), winner: 2 })).toBe(0)
    expect(scoreFor({ ...newGame(), draw: true })).toBe(150)
    expect(scoreFor({ ...newGame(), winner: 1, hand: [0, 0], cells: [...newGame().cells.map((_, i) => (i < 4 ? 1 : 0))] as Cell[], moves: 60 })).toBe(400 + 240 + 140)
  })
})

describe('state validation', () => {
  it('accepts a real state and rejects bad ones', () => {
    expect(isState(newGame())).toBe(true)
    expect(isState({ ...newGame(), cells: [1, 2] })).toBe(false)
    expect(isState({ ...newGame(), hand: [10, 9] })).toBe(false)
    expect(isState(null)).toBe(false)
  })
})

describe('computer', () => {
  it('completes a mill when it can and blocks one when it must', () => {
    const win = withCells({ 0: 2, 1: 2, 8: 1, 9: 1 }, { turn: 2, hand: [7, 7] })
    expect(aiPly(win, createRandom('a'), 'normal')).toEqual({ type: 'place', to: 2 })
    const block = withCells({ 0: 1, 1: 1, 12: 2, 20: 2 }, { turn: 2, hand: [7, 7] })
    const ply = aiPly(block, createRandom('b'), 'hard')
    expect(ply).toEqual({ type: 'place', to: 2 })
  })
  it('plays a whole game to the end legally at every level, and is deterministic for a seed', () => {
    for (const level of ['easy', 'normal'] as const) {
      const run = () => {
        const rnd = createRandom(`g-${level}`)
        let s = newGame()
        for (let i = 0; i < 400 && !isOver(s); i++) {
          const ply = aiPly(s, rnd, level)!
          const n = apply(s, ply)
          expect(n).not.toBe(s)
          s = n
        }
        return s
      }
      const a = run()
      expect(isOver(a)).toBe(true)
      expect(run()).toEqual(a)
    }
  })
})
