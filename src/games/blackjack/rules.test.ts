import { describe, expect, it } from 'vitest'
import { blackjackTable } from '../../lib/tables'
import { START_CHIPS, applyAction, basicStrategy, canDouble, canSplit, handValue, isBlackjack, newGame, validBet, type State } from './rules'

const c = (rank: number, suit = 0) => suit * 13 + rank - 1
/** A game state in the middle of a hand with chosen cards. */
function play(player: number[], dealer: number[], extra: Partial<State> = {}): State {
  return { ...newGame('t'), phase: 'play', chips: 900, hands: [{ cards: player, bet: 100, doubled: false, done: false, fromSplit: false }], dealer, ...extra }
}

describe('hand values', () => {
  it('counts aces as 1 or 11 and recognises soft totals', () => {
    expect(handValue([c(1), c(6)])).toEqual({ total: 17, soft: true })
    expect(handValue([c(1), c(6), c(10)])).toEqual({ total: 17, soft: false })
    expect(handValue([c(1), c(1), c(9)])).toEqual({ total: 21, soft: true })
    expect(handValue([c(13), c(12), c(5)]).total).toBe(25)
  })
  it('a blackjack is exactly two cards worth 21', () => {
    expect(isBlackjack([c(1), c(13)])).toBe(true)
    expect(isBlackjack([c(7), c(7), c(7)])).toBe(false)
  })
})

describe('betting', () => {
  it('bets are whole 5s from 10 up to 500 and never more than the chips', () => {
    expect(validBet(10, 1000)).toBe(true)
    expect(validBet(5, 1000)).toBe(false)
    expect(validBet(12, 1000)).toBe(false)
    expect(validBet(600, 1000)).toBe(false)
    expect(validBet(50, 40)).toBe(false)
  })
  it('placing a bet takes the chips and deals two cards each, deterministically', () => {
    const a = applyAction(newGame('deal'), { type: 'bet', amount: 50 })
    const b = applyAction(newGame('deal'), { type: 'bet', amount: 50 })
    expect(a).toEqual(b)
    expect(a.hands[0].cards).toHaveLength(2)
    expect(a.dealer).toHaveLength(2)
    expect(a.chips + 50 === START_CHIPS || a.phase === 'settled').toBe(true)
  })
  it('refuses an invalid bet and actions out of turn', () => {
    const s = newGame('x')
    expect(applyAction(s, { type: 'bet', amount: 7 })).toBe(s)
    expect(applyAction(s, { type: 'hit' })).toBe(s)
  })
})

describe('playing a hand', () => {
  it('standing lets the dealer draw to 17 and settles the bet', () => {
    const s = play([c(10), c(9)], [c(10), c(6)])
    const n = applyAction(s, { type: 'stand' })
    expect(n.phase === 'settled' || n.phase === 'over').toBe(true)
    expect(handValue(n.dealer).total).toBeGreaterThanOrEqual(17)
    const h = n.hands[0]
    expect(n.chips).toBe(900 + (h.payout ?? 0))
  })
  it('a winning stand pays 2x the bet back, a push returns it', () => {
    const win = applyAction(play([c(10), c(10)], [c(10), c(7)]), { type: 'stand' })
    expect(win.hands[0].result).toBe('win')
    expect(win.chips).toBe(1100)
    const push = applyAction(play([c(10), c(7)], [c(10), c(7)]), { type: 'stand' })
    expect(push.hands[0].result).toBe('push')
    expect(push.chips).toBe(1000)
  })
  it('bust loses at once and the dealer does not need to draw', () => {
    let s = play([c(10), c(6)], [c(10), c(7)])
    for (let i = 0; i < 6 && s.phase === 'play'; i++) s = applyAction(s, { type: 'hit' })
    expect(s.hands[0].result).toBe('lose')
    expect(s.dealer).toHaveLength(2)
    expect(s.chips).toBe(900)
  })
  it('double takes a second bet, one card, and ends the hand', () => {
    const s = play([c(5), c(6)], [c(10), c(7)])
    expect(canDouble(s)).toBe(true)
    const n = applyAction(s, { type: 'double' })
    expect(n.hands[0].doubled).toBe(true)
    expect(n.hands[0].cards).toHaveLength(3)
    expect(n.phase === 'settled' || n.phase === 'over').toBe(true)
    expect(n.chips).toBe(800 + (n.hands[0].payout ?? 0))
  })
  it('splitting makes two hands with their own bets; split aces take one card each', () => {
    const s = play([c(8), c(8, 1)], [c(10), c(7)])
    expect(canSplit(s)).toBe(true)
    const n = applyAction(s, { type: 'split' })
    expect(n.hands).toHaveLength(2)
    expect(n.hands.every((h) => h.cards.length === 2 && h.fromSplit)).toBe(true)
    const aces = applyAction(play([c(1), c(1, 1)], [c(10), c(7)]), { type: 'split' })
    expect(aces.phase === 'settled' || aces.phase === 'over').toBe(true)
    expect(aces.hands.every((h) => h.cards.length === 2)).toBe(true)
  })
  it('blackjack pays 3:2 unless the dealer has one too', () => {
    const win = applyAction(play([c(1), c(13)], [c(10), c(7)], { hands: [{ cards: [c(1), c(13)], bet: 100, doubled: false, done: false, fromSplit: false }] }), { type: 'stand' })
    expect(win.hands[0].result).toBe('blackjack')
    expect(win.chips).toBe(900 + 250)
    const push = applyAction(play([c(1), c(13)], [c(1, 1), c(12)]), { type: 'stand' })
    expect(push.hands[0].result).toBe('push')
  })
  it('running out of chips ends the session; cashing out ends it between hands', () => {
    const broke = applyAction(play([c(10), c(7)], [c(10), c(10)], { chips: 0 }), { type: 'stand' })
    expect(broke.phase).toBe('over')
    const out = applyAction(newGame('c'), { type: 'cashout' })
    expect(out.phase).toBe('over')
    expect(applyAction(out, { type: 'bet', amount: 50 })).toBe(out)
  })
})

describe('whole sessions', () => {
  it('basic strategy plays 300 hands without an illegal move, keeping chips consistent and the shoe fresh', () => {
    let s = newGame('long')
    let steps = 0
    while (s.phase !== 'over' && s.rounds < 300 && steps++ < 5000) {
      let n: State
      if (s.phase === 'bet' || s.phase === 'settled') n = applyAction(s, { type: 'bet', amount: Math.min(50, s.chips - (s.chips % 5)) })
      else n = applyAction(s, { type: basicStrategy(s) } as never)
      expect(n).not.toBe(s)
      expect(n.chips).toBeGreaterThanOrEqual(0)
      s = n
    }
    expect(s.rounds).toBeGreaterThan(50)
    expect(s.shoeNo).toBeGreaterThanOrEqual(1)
  })

  it('table limits decide which bets are valid, and when you are out', () => {
    const rookie = blackjackTable('rookie')
    expect(validBet(100, 1000, rookie)).toBe(true)
    expect(validBet(150, 1000, rookie)).toBe(false)
    const high = blackjackTable('high')
    expect(validBet(50, 9000, high)).toBe(false)
    expect(validBet(2500, 9000, high)).toBe(true)
    expect(newGame('t', 6000, 'high').table).toBe('high')
    let s = newGame('t', 100, 'high')
    s = applyAction(s, { type: 'cashout' })
    expect(s.phase).toBe('over')
  })
})
