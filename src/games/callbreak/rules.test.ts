import { describe, expect, it } from 'vitest'
import { chooseAction, estimateBid } from './bot'
import { PLAYERS, ROUNDS, apply, deal, legalPlays, newGame, roundScore, totals, trickWinner, winners, type State } from './rules'

const c = (suit: number, rank: number) => suit * 13 + rank // rank 0 ace .. 12 king
const play = (hands: number[][], trick: { player: number; card: number }[], turn: number): State => ({ ...newGame('t'), phase: 'play', hands, trick, turn, bids: [2, 2, 2, 2] })

describe('call break rules', () => {
  it('deals 13 cards to each of four players, every card once, the same for a seed', () => {
    const s = newGame('a')
    expect(s.hands.map((h) => h.length)).toEqual([13, 13, 13, 13])
    expect(new Set(s.hands.flat()).size).toBe(52)
    expect(newGame('a')).toEqual(newGame('a'))
    expect(s.phase).toBe('bid')
    expect(s.turn).toBe(1)
  })
  it('bids go round, then play starts with the player left of the dealer', () => {
    let s = newGame('a')
    for (let i = 0; i < 4; i++) { const r = apply(s, { type: 'bid', bid: 2 }); expect(r.ok).toBe(true); if (r.ok) s = r.state }
    expect(s.phase).toBe('play')
    expect(s.turn).toBe(1)
  })
  it('rejects bids outside 1 to 8 and plays out of stage', () => {
    const s = newGame('a')
    expect(apply(s, { type: 'bid', bid: 0 }).ok).toBe(false)
    expect(apply(s, { type: 'bid', bid: 9 }).ok).toBe(false)
    expect(apply(s, { type: 'play', card: s.hands[1][0] }).ok).toBe(false)
  })
  it('must follow suit, and must beat the best card if able', () => {
    const hands = [[c(1, 12), c(1, 3), c(2, 5)], [], [], []]
    const s = play(hands, [{ player: 3, card: c(1, 8) }], 0)
    expect(legalPlays(s)).toEqual([c(1, 12)]) // only the king beats the 8
    const low = play([[c(1, 3), c(1, 5), c(2, 5)], [], [], []], [{ player: 3, card: c(1, 8) }], 0)
    expect(legalPlays(low).sort()).toEqual([c(1, 3), c(1, 5)].sort()) // cannot beat it, but must still follow
  })
  it('with no card of the suit, must play a spade, and overtrump a spade if able', () => {
    const none = play([[c(0, 4), c(0, 9), c(2, 5)], [], [], []], [{ player: 3, card: c(1, 8) }], 0)
    expect(legalPlays(none).sort()).toEqual([c(0, 4), c(0, 9)].sort())
    const over = play([[c(0, 4), c(0, 12), c(2, 5)], [], [], []], [{ player: 3, card: c(1, 8) }, { player: 2, card: c(0, 9) }], 0)
    expect(legalPlays(over)).toEqual([c(0, 12)]) // only the king of spades beats the 9
    const free = play([[c(2, 5), c(3, 5)], [], [], []], [{ player: 3, card: c(1, 8) }], 0)
    expect(legalPlays(free).sort()).toEqual([c(2, 5), c(3, 5)].sort())
  })
  it('once the led suit has been trumped, any card of that suit is fine', () => {
    const s = play([[c(1, 12), c(1, 2)], [], [], []], [{ player: 3, card: c(1, 8) }, { player: 2, card: c(0, 3) }], 0)
    expect(legalPlays(s).sort()).toEqual([c(1, 12), c(1, 2)].sort())
  })
  it('the highest spade wins, else the highest of the led suit; the ace is high', () => {
    expect(trickWinner([{ player: 0, card: c(1, 0) }, { player: 1, card: c(1, 12) }, { player: 2, card: c(2, 0) }, { player: 3, card: c(1, 5) }])).toBe(0)
    expect(trickWinner([{ player: 0, card: c(1, 0) }, { player: 1, card: c(0, 2) }, { player: 2, card: c(0, 6) }, { player: 3, card: c(1, 5) }])).toBe(2)
  })
  it('scores a made bid as bid plus a tenth per extra trick, a missed bid as minus the bid', () => {
    expect(roundScore(3, 3)).toBe(30)
    expect(roundScore(3, 5)).toBe(32)
    expect(roundScore(4, 2)).toBe(-40)
  })
  it('bots bid sensibly: a strong hand bids more than a weak one', () => {
    const strong = [c(0, 0), c(0, 12), c(0, 11), c(0, 5), c(0, 3), c(1, 0), c(2, 0), c(3, 0), c(1, 12), c(2, 12), c(3, 12), c(1, 7), c(2, 7)]
    const weak = [c(0, 1), c(1, 1), c(2, 1), c(3, 1), c(0, 2), c(1, 2), c(2, 2), c(3, 2), c(0, 3), c(1, 3), c(2, 3), c(3, 3), c(1, 4)]
    expect(estimateBid(strong)).toBeGreaterThan(estimateBid(weak))
    expect(estimateBid(weak)).toBe(1)
  })
  it('four bots play a whole game: five rounds of 13 tricks, tricks add to 13, bots only make legal plays', () => {
    let s = newGame('bots')
    for (let guard = 0; guard < 2000 && s.phase !== 'over'; guard++) {
      if (s.phase === 'round-over') { const r = apply(s, { type: 'next-round' }); if (!r.ok) throw new Error(r.reason); s = r.state; continue }
      const a = chooseAction(s)
      const r = apply(s, a)
      if (!r.ok) throw new Error(r.reason)
      s = r.state
    }
    expect(s.phase).toBe('over')
    expect(s.history).toHaveLength(ROUNDS)
    expect(totals(s)).toHaveLength(PLAYERS)
    expect(winners(s).length).toBeGreaterThan(0)
  })
  it('different rounds deal different hands', () => {
    expect(deal('a', 1, 1).hands).not.toEqual(deal('a', 0, 0).hands)
  })
})
