import { applyAction, bestPlan, card, cardPoints, type Action, type State } from './rules'

/** Cost of a 13-card hand: loose points plus the penalties for a missing pure or second sequence. */
const cost = (ids: number[], wild: number) => { const p = bestPlan(ids, wild); return p.points + (p.pure ? 0 : 30) + (p.runs >= 2 ? 0 : 15) }

function bestDiscard(hand: number[], wild: number, forbidden: number | null) {
  let best = { card: hand[0], cost: Infinity }
  for (const id of hand) {
    if (id === forbidden) continue
    const c = cost(hand.filter((x) => x !== id), wild)
    const tie = c === best.cost && cardPoints(id, wild) > cardPoints(best.card, wild) && !card(id).printedJoker
    if (c < best.cost || tie) best = { card: id, cost: c }
  }
  return best
}

/** Deterministic computer player: takes the top discard only when it lowers its cost, declares when it can. */
export function chooseAction(s: State): Action {
  const hand = s.hands[s.turn]
  if (s.phase === 'draw') {
    const top = s.discard[s.discard.length - 1]
    if (top !== undefined) {
      const now = cost(hand, s.wild)
      const withTop = bestDiscard([...hand, top], s.wild, top)
      if (withTop.cost + 3 <= now) return { type: 'draw', from: 'discard' }
    }
    return { type: 'draw', from: s.stock.length ? 'stock' : 'discard' }
  }
  const pick = bestDiscard(hand, s.wild, s.taken)
  const rest = hand.filter((id) => id !== pick.card)
  const plan = bestPlan(rest, s.wild)
  if (plan.complete && plan.points === 0) {
    const declare: Action = { type: 'declare', card: pick.card, groups: plan.groups.map((g) => g.ids) }
    if (applyAction(s, declare) !== s) return declare
  }
  return { type: 'discard', card: pick.card }
}
