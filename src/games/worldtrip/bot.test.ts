import { describe, expect, it } from 'vitest'
import { actor, chooseAction } from './bot'
import { applyAction, newGame, standings, type State } from './rules'

/** Plays a whole match where every seat is a computer. */
function playOut(seed: string, players: number, turnsEach = 12) {
  let s: State = newGame(players, seed, turnsEach)
  let steps = 0
  while (s.phase !== 'done') {
    const next = applyAction(s, chooseAction(s))
    expect(next).not.toBe(s) // the computer never picks an illegal action
    s = next
    if (++steps > 3000) throw new Error('match did not finish')
  }
  return s
}

describe('computer player', () => {
  it('finishes whole matches with only legal actions, for 2, 3 and 4 seats', () => {
    for (const n of [2, 3, 4]) for (const seed of ['a', 'b', 'c', 'd']) {
      const s = playOut(`${seed}-${n}`, n)
      expect(s.turn).toBe(12 * n)
      expect(standings(s)[0].worth).toBeGreaterThan(0)
    }
  })
  it('is deterministic, so a saved match replays the same', () => {
    expect(playOut('same', 3)).toEqual(playOut('same', 3))
  })
  it('claims stops during a match', () => {
    const s = playOut('claims', 2, 20)
    expect(s.holdings.filter(Boolean).length).toBeGreaterThan(3)
  })
  it('answers an offer for the buyer seat, and declines a bad price', () => {
    const s = newGame(2, 'offer')
    const withOffer: State = { ...s, phase: 'manage', holdings: s.holdings.map((h, i) => (i === 1 ? { owner: 0, centre: false } : h)), offer: { buyer: 1, give: [1], take: [], cash: 9999 } }
    expect(actor(withOffer)).toBe(1)
    expect(chooseAction(withOffer)).toEqual({ type: 'decline' })
    expect(chooseAction({ ...withOffer, offer: { buyer: 1, give: [1], take: [], cash: 1 } })).toEqual({ type: 'accept' })
  })
  it('bids in an auction up to a fair price, then drops out', () => {
    const s = newGame(2, 'auction')
    const base: State = { ...s, phase: 'auction', auction: { space: 1, bid: 0, leader: -1, order: [1, 0], pos: 0, dropped: [false, false] } }
    expect(actor(base)).toBe(1)
    expect(chooseAction(base)).toEqual({ type: 'bid', amount: 10 })
    expect(chooseAction({ ...base, auction: { ...base.auction!, bid: 60, leader: 0 } })).toEqual({ type: 'drop' })
  })
  it('uses a boarding pass or pays to leave the Hotel Stopover when it can afford to, otherwise rolls', () => {
    const s = newGame(2, 'hotel')
    const stuck = (patch: object): State => ({ ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, inHotel: true, position: 10, ...patch } : p)) })
    expect(chooseAction(stuck({ pass: true }))).toEqual({ type: 'usepass' })
    expect(chooseAction(stuck({ cash: 1500 }))).toEqual({ type: 'payout' })
    expect(chooseAction(stuck({ cash: 300 }))).toEqual({ type: 'roll' })
  })
  it('weighs a trade by what it receives, gives and pays', () => {
    const s = newGame(2, 'trade')
    const holdings = s.holdings.map((h, i) => (i === 1 ? { owner: 0, centre: false } : i === 3 ? { owner: 1, centre: false } : h))
    const base: State = { ...s, phase: 'manage', holdings }
    // Vancouver (60) for Toronto (80): the computer would lose value, and Toronto completes nothing for it
    expect(chooseAction({ ...base, offer: { buyer: 1, give: [1], take: [3], cash: 0 } })).toEqual({ type: 'decline' })
    // ...but it takes the same swap if the other player adds enough credits
    expect(chooseAction({ ...base, offer: { buyer: 1, give: [1], take: [3], cash: -60 } })).toEqual({ type: 'accept' })
  })
})
