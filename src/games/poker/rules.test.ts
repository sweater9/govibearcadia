import { describe, expect, it } from 'vitest'
import { START_CHIPS, applyAction, bestScore, blindsFor, categoryOf, handName, legalActions, newGame, potOf, type State } from './rules'

const c = (rank: number, suit: number) => suit * 13 + (rank === 14 ? 1 : rank) - 1

describe('hand ranking', () => {
  const s = (...cards: [number, number][]) => bestScore(cards.map(([r, su]) => c(r, su)))
  it('orders every category and names it', () => {
    const hands = [
      s([14, 0], [10, 1], [8, 2], [5, 3], [3, 0]),
      s([9, 0], [9, 1], [8, 2], [5, 3], [3, 0]),
      s([9, 0], [9, 1], [8, 2], [8, 3], [3, 0]),
      s([9, 0], [9, 1], [9, 2], [5, 3], [3, 0]),
      s([9, 0], [8, 1], [7, 2], [6, 3], [5, 0]),
      s([14, 0], [10, 0], [8, 0], [5, 0], [3, 0]),
      s([9, 0], [9, 1], [9, 2], [5, 3], [5, 0]),
      s([9, 0], [9, 1], [9, 2], [9, 3], [5, 0]),
      s([9, 0], [8, 0], [7, 0], [6, 0], [5, 0]),
    ]
    for (let i = 1; i < hands.length; i++) expect(hands[i]).toBeGreaterThan(hands[i - 1])
    expect(hands.map(categoryOf)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(handName(hands[6])).toBe('Full house')
  })
  it('the wheel A-2-3-4-5 is the lowest straight, and ace-high is the highest', () => {
    const wheel = s([14, 0], [2, 1], [3, 2], [4, 3], [5, 0])
    const six = s([2, 0], [3, 1], [4, 2], [5, 3], [6, 0])
    const broadway = s([10, 0], [11, 1], [12, 2], [13, 3], [14, 0])
    expect(categoryOf(wheel)).toBe(4)
    expect(six).toBeGreaterThan(wheel)
    expect(broadway).toBeGreaterThan(six)
  })
  it('picks the best five of seven and compares kickers', () => {
    const better = s([14, 0], [14, 1], [13, 2], [7, 3], [4, 0], [3, 1], [2, 2])
    const worse = s([14, 2], [14, 3], [12, 2], [7, 1], [4, 1], [3, 0], [2, 3])
    expect(better).toBeGreaterThan(worse)
    expect(categoryOf(s([2, 0], [2, 1], [2, 2], [9, 3], [9, 0], [13, 1], [5, 2]))).toBe(6)
  })
})

describe('a hand', () => {
  it('deals two cards each, posts blinds and gives the action to the right player', () => {
    const s = newGame(4, 'deal')
    expect(s.players.every((p) => p.hole.length === 2)).toBe(true)
    const [sb, bb] = blindsFor(1)
    expect(potOf(s)).toBe(sb + bb)
    expect(s.players.reduce((n, p) => n + p.chips, 0) + potOf(s)).toBe(START_CHIPS * 4)
    expect(s.street).toBe('preflop')
    expect(s.turn).toBeGreaterThanOrEqual(0)
    expect(newGame(4, 'deal')).toEqual(s)
  })
  it('heads-up, the button posts the small blind and acts first', () => {
    const s = newGame(2, 'hu')
    const sbSeat = s.button
    expect(s.players[sbSeat].bet).toBe(blindsFor(1)[0])
    expect(s.turn).toBe(sbSeat)
  })
  it('folding to the last player gives them the pot and ends the hand', () => {
    let s = newGame(3, 'fold')
    const pot = potOf(s)
    while (s.street === 'preflop') s = applyAction(s, { type: 'fold' })
    expect(s.street).toBe('showdown')
    expect(s.wins).toHaveLength(1)
    expect(s.wins[0].amount).toBe(pot)
    expect(s.players.reduce((n, p) => n + p.chips, 0)).toBe(START_CHIPS * 3)
  })
  it('refuses illegal actions: checking against a bet, raising under the minimum, acting after showdown', () => {
    const s = newGame(3, 'illegal')
    expect(applyAction(s, { type: 'check' })).toBe(s)
    expect(applyAction(s, { type: 'raise', to: s.currentBet + 1 })).toBe(s)
    expect(applyAction(s, { type: 'raise', to: s.currentBet })).toBe(s)
    const legal = legalActions(s)
    expect(legal.call).toBe(true)
    expect(applyAction(s, { type: 'raise', to: legal.min })).not.toBe(s)
  })
  it('calling everything checks down to a showdown that conserves every chip', () => {
    let s = newGame(3, 'checkdown')
    let steps = 0
    while (s.street !== 'showdown' && steps++ < 60) s = applyAction(s, legalActions(s).check ? { type: 'check' } : { type: 'call' })
    expect(s.street).toBe('showdown')
    expect(s.board).toHaveLength(5)
    expect(s.wins.length).toBeGreaterThan(0)
    expect(s.players.reduce((n, p) => n + p.chips, 0)).toBe(START_CHIPS * 3)
  })
  it('an all-in and a call run the board out and award side pots correctly', () => {
    let s: State = newGame(3, 'allin')
    s = { ...s, players: s.players.map((p, i) => ({ ...p, chips: p.chips + (i === 0 ? 0 : 0) })) }
    let steps = 0
    while (s.street !== 'showdown' && steps++ < 60) {
      const l = legalActions(s)
      s = applyAction(s, l.raise ? { type: 'raise', to: l.max } : l.call ? { type: 'call' } : { type: 'check' })
    }
    expect(s.street).toBe('showdown')
    expect(s.board).toHaveLength(5)
    expect(s.players.reduce((n, p) => n + p.chips, 0)).toBe(START_CHIPS * 3)
  })
})

import { chooseAction } from './bot'
describe('computer players', () => {
  for (const n of [2, 3, 5]) {
    it(`a ${n}-player tournament played by computers always ends with one winner and conserves chips`, () => {
      let s = newGame(n, `bots${n}`)
      let steps = 0
      while (s.street !== 'over' && steps++ < 20000) {
        const a = s.street === 'showdown' ? ({ type: 'next' } as const) : chooseAction(s)
        const next = applyAction(s, a)
        expect(next).not.toBe(s)
        const held = next.players.reduce((sum, p) => sum + p.chips + (next.street === 'showdown' || next.street === 'over' ? 0 : p.total), 0)
        expect(held).toBe(START_CHIPS * n)
        s = next
      }
      expect(s.street).toBe('over')
      expect(s.players.reduce((sum, p) => sum + p.chips, 0)).toBe(START_CHIPS * n)
      expect(s.winner === null || s.players[s.winner].chips === START_CHIPS * n).toBe(true)
    }, 60000)
  }
})
