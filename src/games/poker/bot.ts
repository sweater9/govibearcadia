import { createRandom } from '../../lib/rng'
import { applyAction, bestScore, blindsFor, categoryOf, legalActions, potOf, rankValue, suitOf, type Action, type State } from './rules'

/** How strong the computer thinks its hand is, from 0 to 1. */
export function strength(s: State, seat: number): number {
  const hole = s.players[seat].hole
  const [a, b] = hole.map(rankValue)
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  const suited = suitOf(hole[0]) === suitOf(hole[1])
  if (s.board.length === 0) {
    if (a === b) return 0.5 + ((hi - 2) / 12) * 0.45
    const gap = hi - lo
    return Math.min(0.7, ((hi - 2) / 12) * 0.45 + ((lo - 2) / 12) * 0.2 + (suited ? 0.06 : 0) + (gap === 1 ? 0.04 : gap === 2 ? 0.02 : 0) + (hi === 14 ? 0.05 : 0))
  }
  const score = bestScore([...hole, ...s.board])
  const cat = categoryOf(score)
  const boardTop = Math.max(...s.board.map(rankValue))
  let value = [0.15, 0.45, 0.75, 0.82, 0.88, 0.9, 0.97, 0.99, 1][cat]
  if (cat === 0) value += (hi - 2) / 12 * 0.1
  if (cat === 1) value += hi > boardTop || a === b ? (a === b && hi > boardTop ? 0.25 : 0.12) : 0
  if (s.board.length < 5 && cat < 5) {
    const suits = [...hole, ...s.board].map(suitOf)
    if ([0, 1, 2, 3].some((su) => suits.filter((x) => x === su).length === 4 && hole.some((h) => suitOf(h) === su))) value += 0.2
  }
  return Math.min(1, value)
}

/** Deterministic computer player (its "randomness" is seeded from the hand and action count, so saved games replay exactly). */
export function chooseAction(s: State): Action {
  const seat = s.turn
  const random = createRandom(`${s.seed}:bot:${s.hand}:${s.actions}`)
  const legal = legalActions(s)
  const p = s.players[seat]
  const str = strength(s, seat)
  const pot = potOf(s)
  const step = blindsFor(s.hand)[0]
  const odds = legal.toCall / (pot + legal.toCall || 1)
  const raiseTo = () => {
    const wanted = s.currentBet + Math.max(s.lastRaise, Math.round((pot * (0.5 + random() * 0.4)) / step) * step)
    const to = Math.min(legal.max, Math.max(legal.min, wanted))
    return to >= p.bet + p.chips * 0.6 ? legal.max : to
  }
  const tryAction = (a: Action): Action => (applyAction(s, a) !== s ? a : legal.check ? { type: 'check' } : legal.call ? { type: 'call' } : { type: 'fold' })
  if (legal.check) {
    if (legal.raise && (str > 0.7 || (str > 0.45 && random() < 0.4) || random() < 0.05)) return tryAction({ type: 'raise', to: raiseTo() })
    return { type: 'check' }
  }
  if (legal.raise && str > 0.78 && random() < 0.55) return tryAction({ type: 'raise', to: raiseTo() })
  const needed = s.board.length === 0 ? 0.22 + (legal.toCall / (p.chips + p.bet + 1)) * 0.6 : odds + 0.12
  if (str >= needed || legal.toCall <= step / 2) return tryAction({ type: 'call' })
  return { type: 'fold' }
}
