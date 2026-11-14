import { MAX_BID, MIN_BID, legalPlays, rankOf, strength, suitOf, trickWinner, type Action, type State } from './rules'

/** A hand's likely tricks: aces and kings, a guarded queen, and the length of the spade suit. */
export function estimateBid(hand: number[]): number {
  let t = 0
  const bySuit = [0, 1, 2, 3].map((su) => hand.filter((c) => suitOf(c) === su))
  for (const [su, cards] of bySuit.entries()) {
    const has = (r: number) => cards.some((c) => rankOf(c) === r)
    if (su === 0) {
      if (has(0)) t += 1
      if (has(12) && cards.length >= 2) t += 0.9
      if (has(11) && cards.length >= 3) t += 0.6
      if (cards.length > 3) t += (cards.length - 3) * 0.8
    } else {
      if (has(0)) t += 1
      if (has(12) && cards.length >= 2) t += 0.6
      if (cards.length <= 1 && bySuit[0].length >= 3) t += 0.5 // a short suit can be trumped
    }
  }
  return Math.max(MIN_BID, Math.min(MAX_BID, Math.round(t)))
}

const lowest = (cards: number[]) => cards.reduce((a, b) => (strength(b) < strength(a) ? b : a))

/** Deterministic computer player: bids on its hand, then takes the tricks it needs and ducks the ones it does not. */
export function chooseAction(s: State): Action {
  const hand = s.hands[s.turn]
  if (s.phase === 'bid') return { type: 'bid', bid: estimateBid(hand) }
  const legal = legalPlays(s)
  const need = (s.bids[s.turn] as number) - s.tricks[s.turn]
  if (!s.trick.length) {
    const lead = legal.filter((c) => suitOf(c) !== 0)
    const aces = lead.filter((c) => rankOf(c) === 0)
    if (need > 0 && aces.length) return { type: 'play', card: aces[0] }
    return { type: 'play', card: lowest(lead.length ? lead : legal) }
  }
  const wins = legal.filter((c) => trickWinner([...s.trick, { player: s.turn, card: c }]) === s.turn)
  if (need > 0 && wins.length) return { type: 'play', card: lowest(wins) }
  const loses = legal.filter((c) => !wins.includes(c))
  return { type: 'play', card: lowest(loses.length ? loses : legal) }
}
