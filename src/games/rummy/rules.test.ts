import { describe, expect, it } from 'vitest'
import { chooseAction } from './bot'
import { DECK_SIZE, applyAction, bestPlan, card, declareError, isPureRun, isRun, isSet, newGame, penaltyPoints, type State } from './rules'

/** id for a rank and suit (first deck). suit 0 spades, 1 hearts, 2 diamonds, 3 clubs. */
const c = (rank: number, suit: number) => suit * 13 + (rank - 1)
const JOKER = 104

describe('melds', () => {
  it('pure sequences have no joker, one suit, consecutive ranks; the ace is low or high but never wraps', () => {
    expect(isPureRun([c(4, 1), c(5, 1), c(6, 1)])).toBe(true)
    expect(isPureRun([c(1, 0), c(2, 0), c(3, 0)])).toBe(true)
    expect(isPureRun([c(12, 0), c(13, 0), c(1, 0)])).toBe(true)
    expect(isPureRun([c(13, 0), c(1, 0), c(2, 0)])).toBe(false)
    expect(isPureRun([c(4, 1), c(5, 2), c(6, 1)])).toBe(false)
    expect(isPureRun([c(4, 1), JOKER, c(6, 1)])).toBe(false)
    expect(isPureRun([c(4, 1), c(5, 1)])).toBe(false)
  })
  it('a joker can fill a gap or extend a run, and a wild-rank card counts as a joker', () => {
    expect(isRun([c(4, 1), JOKER, c(6, 1)], 9)).toBe(true)
    expect(isRun([c(4, 1), c(5, 1), JOKER], 9)).toBe(true)
    expect(isRun([c(4, 1), c(9, 3), c(6, 1)], 9)).toBe(true)
    expect(isRun([c(4, 1), c(8, 1), JOKER], 9)).toBe(false)
    expect(isRun([c(13, 1), JOKER, c(1, 1)], 9)).toBe(true)
  })
  it('sets are 3 or 4 of a rank in different suits', () => {
    expect(isSet([c(7, 0), c(7, 1), c(7, 2)], 2)).toBe(true)
    expect(isSet([c(7, 0), c(7, 1), c(7, 2), c(7, 3)], 2)).toBe(true)
    expect(isSet([c(7, 0), c(7, 0) + 52, c(7, 2)], 2)).toBe(false)
    expect(isSet([c(7, 0), c(7, 1), JOKER], 2)).toBe(true)
    expect(isSet([c(7, 0), c(8, 1), c(7, 2)], 2)).toBe(false)
  })
})

describe('declaring', () => {
  const wild = 11
  const hand = [c(1, 0), c(2, 0), c(3, 0), c(4, 0), c(5, 1), c(6, 1), JOKER, c(9, 2), c(9, 3), c(9, 1), c(12, 3), c(13, 3), c(1, 3), c(8, 2)]
  it('needs every card grouped, a pure sequence and a second sequence', () => {
    const groups = [[c(1, 0), c(2, 0), c(3, 0), c(4, 0)], [c(5, 1), c(6, 1), JOKER].slice(0, 3), [c(9, 2), c(9, 3), c(9, 1)], [c(12, 3), c(13, 3), c(1, 3)]]
    expect(declareError(hand, c(8, 2), groups, wild)).toBeNull()
    expect(declareError(hand, c(8, 2), groups.slice(0, 3), wild)).toMatch(/every card/i)
    const noPure = [[c(5, 1), c(6, 1), JOKER], [c(9, 2), c(9, 3), c(9, 1)], [c(12, 3), c(13, 3), c(1, 3)]]
    expect(declareError([c(5, 1), c(6, 1), JOKER, c(9, 2), c(9, 3), c(9, 1), c(12, 3), c(13, 3), c(1, 3), c(1, 0), c(2, 0), c(4, 2), c(5, 2), c(8, 2)], c(8, 2), noPure, wild)).not.toBeNull()
  })
  it('the planner finds that grouping and counts zero loose points', () => {
    const plan = bestPlan(hand.filter((id) => id !== c(8, 2)), wild)
    expect(plan.complete).toBe(true)
    expect(plan.points).toBe(0)
  })
  it('without a pure sequence a rival scores every card, capped at 80', () => {
    const none = [c(2, 1), c(5, 2), c(7, 3), c(9, 0), c(10, 1), c(12, 2), c(13, 3), c(1, 1), c(4, 0), c(6, 2), c(8, 3), c(3, 1), c(11, 0)]
    expect(penaltyPoints(none, 11)).toBeLessThanOrEqual(80)
    expect(penaltyPoints(none, 11)).toBeGreaterThan(0)
  })
})

describe('game', () => {
  it('deals 13 cards each from 106, flips a wild joker and a first discard', () => {
    const s = newGame(3, 'deal')
    expect(s.hands.every((h) => h.length === 13)).toBe(true)
    const all = [...s.hands.flat(), ...s.stock, ...s.discard]
    expect(all.length + 1).toBe(DECK_SIZE) // one card is the face-up wild joker
    expect(new Set(all).size).toBe(all.length)
    expect(s.wild).toBeGreaterThanOrEqual(1)
    expect(s.wild).toBeLessThanOrEqual(13)
    expect(card(104).printedJoker).toBe(true)
  })
  it('is deterministic for a seed', () => {
    expect(newGame(2, 'same')).toEqual(newGame(2, 'same'))
    expect(newGame(2, 'same').hands).not.toEqual(newGame(2, 'other').hands)
  })
  it('draw then discard passes the turn; the card taken from the discard cannot go straight back', () => {
    let s = newGame(2, 'turns')
    expect(applyAction(s, { type: 'discard', card: s.hands[0][0] })).toBe(s)
    s = applyAction(s, { type: 'draw', from: 'discard' })
    expect(s.hands[0]).toHaveLength(14)
    const taken = s.taken!
    expect(applyAction(s, { type: 'discard', card: taken })).toBe(s)
    s = applyAction(s, { type: 'discard', card: s.hands[0][0] })
    expect(s.turn).toBe(1)
    expect(s.phase).toBe('draw')
  })
  it('refuses an invalid declaration and leaves the state alone', () => {
    let s = newGame(2, 'bad-declare')
    s = applyAction(s, { type: 'draw', from: 'stock' })
    const hand = s.hands[0]
    expect(applyAction(s, { type: 'declare', card: hand[0], groups: [hand.slice(1)] })).toBe(s)
  })
  for (const players of [2, 3, 4]) {
    it(`computers play a ${players}-player game to the end with a winner and scores`, () => {
      let s: State = newGame(players, `bots${players}`)
      let steps = 0
      while (s.phase !== 'done' && steps++ < 4000) {
        const a = chooseAction(s)
        const next = applyAction(s, a)
        expect(next).not.toBe(s)
        s = next
      }
      expect(s.phase).toBe('done')
      expect(s.winner).not.toBeNull()
      expect(s.scores).toHaveLength(players)
      expect(Math.min(...s.scores!)).toBe(s.scores![s.winner!])
      expect(Math.max(...s.scores!)).toBeLessThanOrEqual(80)
    }, 60000)
  }
})

describe('dropping and wrong declarations', () => {
  it('a drop before the first draw costs 20 and a drop after drawing costs 40', () => {
    const first = applyAction(newGame(3, 'drop-a'), { type: 'drop' })
    expect(first.out).toEqual([20, null, null])
    expect(first.turn).toBe(1)
    let s = newGame(3, 'drop-b')
    s = applyAction(s, { type: 'draw', from: 'stock' })
    s = applyAction(s, { type: 'discard', card: s.hands[0][0] })
    s = applyAction(s, { type: 'draw', from: 'stock' })
    s = applyAction(s, { type: 'discard', card: s.hands[1][0] })
    s = applyAction(s, { type: 'draw', from: 'stock' })
    s = applyAction(s, { type: 'discard', card: s.hands[2][0] })
    expect(applyAction(s, { type: 'drop' }).out[0]).toBe(40)
  })
  it('a dropped player is skipped and the last player left wins the deal', () => {
    let s = applyAction(newGame(3, 'drop-c'), { type: 'drop' })
    s = applyAction(s, { type: 'drop' })
    expect(s.phase).toBe('done')
    expect(s.winner).toBe(2)
    expect(s.scores).toEqual([20, 20, 0])
  })
  it('a drop is only possible before drawing, and a wrong declaration only after', () => {
    const s = newGame(2, 'drop-d')
    expect(applyAction(s, { type: 'wrong-show' })).toBe(s)
    const drawn = applyAction(s, { type: 'draw', from: 'stock' })
    expect(applyAction(drawn, { type: 'drop' })).toBe(drawn)
  })
  it('a wrong declaration costs 80 and ends the deal for the other player in a two-player game', () => {
    const drawn = applyAction(newGame(2, 'wrong-a'), { type: 'draw', from: 'stock' })
    const s = applyAction(drawn, { type: 'wrong-show' })
    expect(s.phase).toBe('done')
    expect(s.winner).toBe(1)
    expect(s.scores).toEqual([80, 0])
  })
})
