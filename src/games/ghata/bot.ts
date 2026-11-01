import type { Random } from '../../lib/rng'
import { SEATS, apply, dice, legalActions, progress, type Action, type State } from './rules'

/** A simple one-move-ahead player: likes progress, captures and wins; the dice and tie-breaks come from `random`. */
export function chooseAction(s: State, random: Random): Action {
  if (s.phase === 'roll') return { type: 'roll', dice: dice(random) }
  const legal = legalActions(s)
  let best = legal[0]
  let bestScore = -Infinity
  for (const action of legal) {
    const result = apply(s, action)
    if (!result.ok) continue
    const next = result.state
    let score = progress(next, s.turn) - progress(s, s.turn)
    for (const seat of SEATS) if (seat !== s.turn) score -= 0.8 * (progress(next, seat) - progress(s, seat))
    if (action.type === 'release') score += 8
    if (next.winner === s.turn) score += 10_000
    score += random() * 3
    if (score > bestScore) {
      bestScore = score
      best = action
    }
  }
  return best
}
