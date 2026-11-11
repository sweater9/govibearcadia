import { createRandom } from '../../lib/rng'
import { FINISHED, LAST_RING_STEP, TOKENS_EACH, isSafeRing, ringIndex } from './board'

export type State = {
  /** Seat numbers in play, in turn order: 2 players use opposite corners. */
  seats: number[]
  /** Per player, per token: -1 in the yard, 0 to 50 on the ring, 51 to 55 in the home column, 56 finished. */
  tokens: number[][]
  turn: number
  phase: 'roll' | 'move' | 'done'
  dice: number | null
  rolledBy: number | null
  /** Sixes in a row for the player on turn. */
  sixes: number
  rolls: number
  seed: string
  winner: number | null
  captures: number[]
  message: string
}
export type Action = { type: 'roll' } | { type: 'move'; token: number }

export const seatsFor = (count: number): number[] => (count === 2 ? [0, 2] : count === 3 ? [0, 1, 2] : [0, 1, 2, 3])

export function newGame(count: number, seed: string): State {
  const seats = seatsFor(count)
  return {
    seats,
    tokens: seats.map(() => Array.from({ length: TOKENS_EACH }, () => -1)),
    turn: 0,
    phase: 'roll',
    dice: null,
    rolledBy: null,
    sixes: 0,
    rolls: 0,
    seed,
    winner: null,
    captures: seats.map(() => 0),
    message: 'Roll a six to bring a token out.',
  }
}

/** Which tokens the player on turn may move with the current dice. */
export function legalMoves(s: State): number[] {
  if (s.phase !== 'move' || s.dice === null) return []
  const out: number[] = []
  s.tokens[s.turn].forEach((p, i) => {
    if (p === -1 ? s.dice === 6 : p + s.dice! <= FINISHED) out.push(i)
  })
  return out
}

const advance = (s: State, message: string): State => ({ ...s, turn: (s.turn + 1) % s.seats.length, phase: 'roll', sixes: 0, message })

function roll(s: State): State {
  const dice = 1 + Math.floor(createRandom(`${s.seed}:${s.rolls}`)() * 6)
  const sixes = dice === 6 ? s.sixes + 1 : 0
  const base: State = { ...s, dice, rolledBy: s.turn, rolls: s.rolls + 1, sixes }
  if (sixes === 3) return advance(base, 'Three sixes in a row: the turn is lost.')
  const moving: State = { ...base, phase: 'move', message: '' }
  return legalMoves(moving).length === 0 ? advance(base, dice === 6 ? 'No token can move.' : 'No move possible.') : moving
}

export function applyAction(s: State, action: Action): State {
  if (s.phase === 'done') return s
  if (action.type === 'roll') return s.phase === 'roll' ? roll(s) : s
  if (s.phase !== 'move' || !legalMoves(s).includes(action.token)) return s
  const dice = s.dice!
  const tokens = s.tokens.map((list) => list.slice())
  const from = tokens[s.turn][action.token]
  const to = from === -1 ? 0 : from + dice
  tokens[s.turn][action.token] = to
  const captures = s.captures.slice()
  let captured = 0
  if (to <= LAST_RING_STEP) {
    const ring = ringIndex(s.seats[s.turn], to)
    if (!isSafeRing(ring)) {
      s.seats.forEach((seat, slot) => {
        if (slot === s.turn) return
        tokens[slot].forEach((q, i) => {
          if (q >= 0 && q <= LAST_RING_STEP && ringIndex(seat, q) === ring) {
            tokens[slot][i] = -1
            captured++
          }
        })
      })
    }
  }
  captures[s.turn] += captured
  const next: State = { ...s, tokens, captures, dice, rolledBy: s.turn }
  if (tokens[s.turn].every((p) => p === FINISHED)) return { ...next, phase: 'done', winner: s.turn, message: 'All four tokens are home.' }
  const home = to === FINISHED
  const again = dice === 6 || captured > 0 || home
  const note = captured > 0 ? `Captured ${captured === 1 ? 'a token' : `${captured} tokens`}.` : home ? 'A token is home.' : ''
  if (again) return { ...next, phase: 'roll', sixes: dice === 6 ? s.sixes : 0, message: `${note}${note ? ' ' : ''}Roll again.` }
  return advance(next, note)
}

export const homeCount = (s: State, slot: number) => s.tokens[slot].filter((p) => p === FINISHED).length
