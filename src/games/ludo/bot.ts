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

/** A simple, deterministic computer player: finish, capture, leave the yard, reach safety, then run the front token. No randomness, so a saved match replays identically. */
export function chooseAction(s: State): Action {
  if (s.phase === 'roll') return { type: 'roll' }
  const seat = s.seats[s.turn]
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
      if (captures && !isSafeRing(ring)) score += 80
    }
    if (from >= 0 && from <= LAST_RING_STEP && threatened(s, ringIndex(seat, from)) && !isSafeRing(ringIndex(seat, from))) score += 25
    if (score > bestScore) {
      bestScore = score
      best = token
    }
  }
  return { type: 'move', token: best }
}
