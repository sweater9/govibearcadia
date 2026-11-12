import { BOARD, GROUPS, CENTRE_COST, isClaimable } from './board'
import { AUCTION_STEP, activePlayer, canBuildCentre, feeFor, priceOf, type Action, type State } from './rules'

/** Credits a computer keeps in hand so one visitor fee cannot empty it. */
const RESERVE = 150

/** Who has to act now: the bidder during an auction, the buyer while an offer is pending, otherwise the player whose turn it is. */
export const actor = (s: State) => (s.auction ? s.auction.order[s.auction.pos] : s.offer ? s.offer.buyer : activePlayer(s))

/** Would owning this stop give the player every city of its colour group? */
function completesGroup(s: State, player: number, space: number): boolean {
  const sp = BOARD[space]
  return sp.kind === 'city' && GROUPS[sp.group].every((i) => i === space || s.holdings[i]?.owner === player)
}

/** A simple, deterministic computer player: claims stops while it stays solvent, builds visitor centres, and takes fair offers. No randomness, so a saved match replays identically. */
export function chooseAction(s: State): Action {
  if (s.auction) {
    const { space, bid, order, pos } = s.auction
    const bidder = order[pos]
    const ceiling = Math.floor(priceOf(BOARD[space]) * (completesGroup(s, bidder, space) ? 1.3 : 0.8))
    const raise = bid + AUCTION_STEP
    return raise <= ceiling && s.players[bidder].cash - raise >= 100 ? { type: 'bid', amount: raise } : { type: 'drop' }
  }
  if (s.offer) {
    const { buyer, space, price } = s.offer
    const value = priceOf(BOARD[space])
    const fair = price <= Math.floor(value * (completesGroup(s, buyer, space) ? 1.4 : 0.9))
    return fair && s.players[buyer].cash - price >= 100 ? { type: 'accept' } : { type: 'decline' }
  }
  const index = activePlayer(s)
  const me = s.players[index]
  if (s.phase === 'roll') return { type: 'roll' }
  if (s.phase === 'buy') {
    const space = BOARD[me.position]
    if (!isClaimable(space)) return { type: 'skip' }
    const affordable = me.cash >= space.price
    return affordable && (me.cash - space.price >= RESERVE || completesGroup(s, index, me.position)) ? { type: 'buy' } : { type: 'skip' }
  }
  let best = -1
  let bestFee = -1
  s.holdings.forEach((h, i) => {
    const sp = BOARD[i]
    if (h?.owner !== index || sp.kind !== 'city' || !canBuildCentre(s, index, i) || me.cash - CENTRE_COST[sp.group] < RESERVE) return
    const fee = feeFor(sp, true)
    if (fee > bestFee) {
      best = i
      bestFee = fee
    }
  })
  return best >= 0 ? { type: 'upgrade', space: best } : { type: 'end' }
}
