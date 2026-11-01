import type { Random } from '../../lib/rng'
import { apply, legalPits, other, seedsInRow, type Player, type State } from './rules'

export type Level = 'easy' | 'medium' | 'hard'
export const LEVELS: readonly Level[] = ['easy', 'medium', 'hard']

/** Seeds the mover has gained by the end of an action, from the mover's point of view. */
const gain = (before: State, after: State, me: Player) => after.stores[me] - before.stores[me]

/** How good a position is for `me`: captured seeds count most, seeds sitting in your own row count a little. */
export function evaluate(s: State, me: Player): number {
  const you = other(me)
  if (s.phase === 'over') return s.winner === me ? 10000 : s.winner === you ? -10000 : 0
  return (s.stores[me] - s.stores[you]) * 10 + (seedsInRow(s, me) - seedsInRow(s, you))
}

/** The first action of a turn can earn a second one; the greedy score looks at both. */
function greedyScore(s: State, pit: number, me: Player): number {
  const first = apply(s, { type: 'sow', pit }, false)
  if (!first.ok) return -Infinity
  let best = gain(s, first.state, me)
  if (first.state.phase === 'play' && first.state.turn === me && first.state.sowings > 0) {
    // Same player to move again: a second sowing was earned. Take the best follow-up.
    let follow = 0
    for (const p of legalPits(first.state)) {
      const second = apply(first.state, { type: 'sow', pit: p }, false)
      if (second.ok) follow = Math.max(follow, gain(first.state, second.state, me))
    }
    best += follow
  }
  return best
}

function negamax(s: State, depth: number, alpha: number, beta: number, me: Player): number {
  const moves = s.phase === 'play' ? legalPits(s) : []
  if (depth === 0 || moves.length === 0) return evaluate(s, me)
  const maximising = s.turn === me
  let best = maximising ? -Infinity : Infinity
  for (const pit of moves) {
    const r = apply(s, { type: 'sow', pit }, false)
    if (!r.ok) continue
    const v = negamax(r.state, depth - 1, alpha, beta, me)
    if (maximising) {
      best = Math.max(best, v)
      alpha = Math.max(alpha, best)
    } else {
      best = Math.min(best, v)
      beta = Math.min(beta, best)
    }
    if (beta <= alpha) break
  }
  return best
}

/** Search depth in sowings (an earned second sowing counts as one more). */
export const HARD_DEPTH = 5

/**
 * Chooses a pit for the player to move. Always a legal pit; undefined only when there is none.
 * Easy: any legal pit. Medium: the biggest immediate capture, counting an earned second sowing.
 * Hard: a deterministic alpha-beta search a few sowings deep (captures, seeds in each row, the match result).
 */
export function choosePit(s: State, level: Level, random: Random): number | undefined {
  const moves = legalPits(s)
  if (moves.length === 0) return undefined
  if (level === 'easy') return moves[Math.floor(random() * moves.length)]
  const me = s.turn
  let best = moves[0]
  let bestScore = -Infinity
  for (const pit of moves) {
    let score: number
    if (level === 'medium') score = greedyScore(s, pit, me)
    else {
      const r = apply(s, { type: 'sow', pit }, false)
      score = r.ok ? negamax(r.state, HARD_DEPTH - 1, -Infinity, Infinity, me) : -Infinity
    }
    if (score > bestScore) {
      bestScore = score
      best = pit
    }
  }
  return best
}
