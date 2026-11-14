import { describe, expect, it } from 'vitest'
import { solve } from './ai'
import { apply, autoFinish, canAutoFinish, canMove, hasMoves, isWon, legalMoves, newGame, rankOf, suitOf, toFoundation, type State } from './rules'

const card = (suit: number, rank: number) => suit * 13 + rank
const empty = (): State => ({ tableau: Array.from({ length: 7 }, () => ({ down: [], up: [] })), stock: [], waste: [], foundations: [[], [], [], []], draw: 1, moves: 0, points: 0, recycles: 0 })

describe('deal', () => {
  it('lays 28 cards in the tableau and 24 in the stock, every card once', () => {
    const s = newGame('deal-1')
    expect(s.tableau.map((p) => p.down.length)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(s.tableau.every((p) => p.up.length === 1)).toBe(true)
    expect(s.stock).toHaveLength(24)
    const all = [...s.stock, ...s.tableau.flatMap((p) => [...p.down, ...p.up])]
    expect(new Set(all).size).toBe(52)
  })
  it('is the same for the same seed and different for another', () => {
    expect(newGame('same')).toEqual(newGame('same'))
    expect(newGame('same')).not.toEqual(newGame('other'))
  })
})

describe('drawing', () => {
  it('draws one or three cards, and recycles the waste when the stock runs out', () => {
    let s = newGame('draw', 3)
    s = apply(s, { type: 'draw' })
    expect(s.waste).toHaveLength(3)
    expect(s.stock).toHaveLength(21)
    for (let i = 0; i < 7; i++) s = apply(s, { type: 'draw' })
    expect(s.stock).toHaveLength(0)
    const before = s.waste.length
    s = apply(s, { type: 'draw' })
    expect(s.stock).toHaveLength(before)
    expect(s.waste).toHaveLength(0)
    expect(s.recycles).toBe(1)
  })
  it('does nothing when there is nothing to draw', () => {
    const s = empty()
    expect(apply(s, { type: 'draw' })).toBe(s)
  })
})

describe('moves', () => {
  it('builds the tableau down in alternating colours, and only a king goes to an empty pile', () => {
    const s = empty()
    s.tableau[0].up = [card(0, 5)]
    s.tableau[1].up = [card(1, 4)]
    s.tableau[2].up = [card(0, 4)]
    s.tableau[3].up = [card(2, 12)]
    expect(canMove(s, { from: 'tableau', pile: 1, index: 0 }, { to: 'tableau', dest: 0 })).toBe(true)
    expect(canMove(s, { from: 'tableau', pile: 2, index: 0 }, { to: 'tableau', dest: 0 })).toBe(false)
    expect(canMove(s, { from: 'tableau', pile: 3, index: 0 }, { to: 'tableau', dest: 4 })).toBe(true)
    expect(canMove(s, { from: 'tableau', pile: 1, index: 0 }, { to: 'tableau', dest: 4 })).toBe(false)
  })
  it('moves a whole run together and turns up the card beneath it', () => {
    let s = empty()
    s.tableau[0] = { down: [card(3, 0)], up: [card(0, 6), card(1, 5), card(0, 4)] }
    s.tableau[1].up = [card(2, 7)]
    s = apply(s, { type: 'move', from: 'tableau', pile: 0, index: 0, to: 'tableau', dest: 1 })
    expect(s.tableau[1].up).toEqual([card(2, 7), card(0, 6), card(1, 5), card(0, 4)])
    expect(s.tableau[0].up).toEqual([card(3, 0)])
    expect(s.tableau[0].down).toEqual([])
    expect(s.points).toBe(5)
  })
  it('sends cards to the foundation in order and scores them; a card cannot skip ahead', () => {
    let s = empty()
    s.tableau[0].up = [card(1, 1)]
    s.waste = [card(1, 0)]
    expect(canMove(s, { from: 'tableau', pile: 0, index: 0 }, { to: 'foundation' })).toBe(false)
    s = apply(s, { type: 'move', from: 'waste', to: 'foundation' })
    s = toFoundation(s, { from: 'tableau', pile: 0, index: 0 })
    expect(s.foundations[1]).toEqual([card(1, 0), card(1, 1)])
    expect(s.points).toBe(20)
  })
  it('lets you take a card back down from a foundation, for a penalty, but not shuffle it between foundations', () => {
    let s = empty()
    s.foundations[0] = [card(0, 0), card(0, 1)]
    s.points = 30
    s.tableau[0].up = [card(1, 2)]
    expect(canMove(s, { from: 'foundation', suit: 0 }, { to: 'foundation' })).toBe(false)
    s = apply(s, { type: 'move', from: 'foundation', suit: 0, to: 'tableau', dest: 0 })
    expect(s.tableau[0].up).toEqual([card(1, 2), card(0, 1)])
    expect(s.points).toBe(15)
  })
  it('ignores impossible requests without changing anything', () => {
    const s = newGame('bad')
    expect(apply(s, { type: 'move', from: 'tableau', pile: 99, index: 0, to: 'foundation' })).toBe(s)
    expect(apply(s, { type: 'move', from: 'tableau', pile: 0, index: 5, to: 'tableau', dest: 1 })).toBe(s)
    expect(apply(s, { type: 'move', from: 'waste', to: 'tableau', dest: 1 })).toBe(s)
  })
  it('lists every legal move without touching the state', () => {
    const s = newGame('list')
    const copy = JSON.parse(JSON.stringify(s))
    for (const m of legalMoves(s)) expect(apply(s, m)).not.toBe(s)
    expect(s).toEqual(copy)
  })
})

describe('finishing', () => {
  it('detects a win, offers auto-finish once everything is face up, and finishes the rest', () => {
    const s = empty()
    for (let suit = 0; suit < 4; suit++) s.foundations[suit] = Array.from({ length: 11 }, (_, r) => card(suit, r))
    s.tableau[0].up = [card(0, 12), card(1, 11)].reverse()
    s.tableau[0].up = [card(0, 11)]
    s.tableau[1].up = [card(0, 12)]
    s.tableau[2].up = [card(1, 11)]
    s.tableau[3].up = [card(1, 12)]
    s.tableau[4].up = [card(2, 11)]
    s.tableau[5].up = [card(2, 12)]
    s.tableau[6].up = [card(3, 11)]
    s.waste = [card(3, 12)]
    expect(canAutoFinish(s)).toBe(true)
    expect(isWon(autoFinish(s))).toBe(true)
  })
  it('knows when no move is left at all', () => {
    expect(hasMoves(newGame('moves'))).toBe(true)
    expect(hasMoves(empty())).toBe(false)
  })
})

describe('solver', () => {
  it('finds a line that really wins when it replays through the rules', () => {
    let found: { seed: string; line: NonNullable<ReturnType<typeof solve>> } | null = null
    for (let i = 0; i < 40 && !found; i++) {
      const seed = `solve-${i}`
      const line = solve(newGame(seed), 60_000)
      if (line) found = { seed, line }
    }
    expect(found).not.toBeNull()
    let s = newGame(found!.seed)
    for (const m of found!.line) {
      const next = apply(s, m)
      expect(next).not.toBe(s)
      s = next
    }
    expect(isWon(s)).toBe(true)
    expect(s.foundations.every((f, i) => f.every((c) => suitOf(c) === i) && f.every((c, k) => rankOf(c) === k))).toBe(true)
  })
})
