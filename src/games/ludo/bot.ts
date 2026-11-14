import { FINISHED, LAST_RING_STEP, RING_SIZE, isSafeRing, ringIndex } from './board'
import { legalMoves, type Action, type State } from './rules'

/** Is a token at this ring square within one throw of an opponent token behind it? */
function threatened(s: State, ring: number): boolean {
  return s.seats.some((seat, slot) => slot !== s.turn && s.tokens[slot].some((q) => {
    if (q < 0 || q > LAST_RING_STEP) return false
    const gap = (ring - ringIndex(seat, q) + RING_SIZE) % RING_SIZE
    return gap >= 1 && gap <= 6
  }))
}

export type Level = 'easy' | 'normal' | 'hard'
export const LEVELS: Level[] = ['easy', 'normal', 'hard']

/** Computer player, deterministic at every level (no randomness, so a saved match replays identically). Easy only brings tokens out and finishes, otherwise moves its rearmost token and never looks at danger; normal is the rule below; hard also prefers capturing far-advanced tokens and keeps a token on a safe square rather than stepping into danger.
 * Normal: finish, capture, leave the yard, reach safety, then run the front token. No randomness, so a saved match replays identically. */
export function chooseAction(s: State, level: Level = 'normal'): Action {
  if (s.phase === 'roll') return { type: 'roll' }
  const seat = s.seats[s.turn]
  if (level === 'easy') {
    const moves = legalMoves(s)
    const finish = moves.find((t) => s.tokens[s.turn][t] + s.dice! === FINISHED)
    const out = moves.find((t) => s.tokens[s.turn][t] === -1)
    const rearmost = [...moves].sort((a, b) => s.tokens[s.turn][a] - s.tokens[s.turn][b] || a - b).find((t) => s.tokens[s.turn][t] >= 0)
    return { type: 'move', token: finish ?? out ?? rearmost ?? moves[0] }
  }
  let best = -1
  let bestScore = -Infinity
  for (const token of legalMoves(s)) {
    const from = s.tokens[s.turn][token]
    const to = from === -1 ? 0 : from + s.dice!
    let score = to * 0.5
    if (to === FINISHED) score += 100
    if (from === -1) score += 40
    if (to >= 51 && from < 51) score += 30
    if (to <= LAST_RING_STEP) {
      const ring = ringIndex(seat, to)
      if (isSafeRing(ring)) score += 15
      else if (threatened(s, ring)) score -= 25
      const captures = s.seats.some((sSeat, slot) => slot !== s.turn && s.tokens[slot].some((q) => q >= 0 && q <= LAST_RING_STEP && ringIndex(sSeat, q) === ring))
      if (captures && !isSafeRing(ring)) {
        score += 80
        if (level === 'hard') score += Math.max(0, ...s.seats.flatMap((sSeat, slot) => (slot === s.turn ? [] : s.tokens[slot].filter((q) => q >= 0 && q <= LAST_RING_STEP && ringIndex(sSeat, q) === ring))))
      }
    }
    if (level === 'hard' && from >= 0 && from <= LAST_RING_STEP && isSafeRing(ringIndex(seat, from)) && to <= LAST_RING_STEP && !isSafeRing(ringIndex(seat, to))) score -= 12
    if (from >= 0 && from <= LAST_RING_STEP && threatened(s, ringIndex(seat, from)) && !isSafeRing(ringIndex(seat, from))) score += 25
    if (score > bestScore) {
      bestScore = score
      best = token
    }
  }
  return { type: 'move', token: best }
}
