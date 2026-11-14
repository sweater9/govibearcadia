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

function easyDiscard(hand: number[], wild: number, forbidden: number | null) {
  const pick = hand.filter((id) => id !== forbidden).sort((a, b) => cardPoints(b, wild) - cardPoints(a, wild) || a - b)[0] ?? hand[0]
  return { card: pick, cost: cost(hand.filter((x) => x !== pick), wild) }
}

export type Level = 'easy' | 'normal' | 'hard'
export const LEVELS: Level[] = ['easy', 'normal', 'hard']

/** Deterministic computer player. Easy always draws from the stock and throws its highest loose card without looking at its melds; normal takes the top discard only when it lowers its cost by 3 or more; hard takes it for any gain and reaches for cards that complete a run. All levels declare when they can, and none sees another hand. */
export function chooseAction(s: State, level: Level = 'normal'): Action {
  const hand = s.hands[s.turn]
  if (s.phase === 'draw') {
    if (level === 'easy') return { type: 'draw', from: s.stock.length ? 'stock' : 'discard' }
    const top = s.discard[s.discard.length - 1]
    if (top !== undefined) {
      const now = cost(hand, s.wild)
      const withTop = bestDiscard([...hand, top], s.wild, top)
      if (withTop.cost + (level === 'hard' ? 1 : 3) <= now) return { type: 'draw', from: 'discard' }
    }
    return { type: 'draw', from: s.stock.length ? 'stock' : 'discard' }
  }
  const pick = level === 'easy' ? easyDiscard(hand, s.wild, s.taken) : bestDiscard(hand, s.wild, s.taken)
  const rest = hand.filter((id) => id !== pick.card)
  const plan = bestPlan(rest, s.wild)
  if (plan.complete && plan.points === 0) {
    const declare: Action = { type: 'declare', card: pick.card, groups: plan.groups.map((g) => g.ids) }
    if (applyAction(s, declare) !== s) return declare
  }
  return { type: 'discard', card: pick.card }
}
