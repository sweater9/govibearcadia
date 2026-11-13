/**
 * Pure rules for an online World Trip room (two travellers): seats, whose move it is, results and rematches.
 * The Worker runs this and is the only authority. Clients send an action ("roll", "bid 40"); the server checks
 * it is that seat's move and applies the same rules the single-device game uses. The dice seed never leaves the
 * server, so nobody can read the next roll. No React or browser APIs.
 */
import { actor } from './bot'
import { isAction } from './actions'
import { BOARD } from './board'
import { applyAction, DEFAULT_TURNS, newGame, standings, type State } from './rules'

export type Seat = 0 | 1
export type Room = { state: State; round: number; wins: [number, number]; rematch: [boolean, boolean] }
export type Failure = 'game-over' | 'not-your-turn' | 'illegal-move' | 'game-not-over'
export type Outcome = { ok: true; room: Room } | { ok: false; error: Failure }

export const newRoom = (seed: string = crypto.randomUUID()): Room => ({ state: newGame(2, seed, DEFAULT_TURNS), round: 1, wins: [0, 0], rematch: [false, false] })

/** The seat that won a finished trip, or null for a tie. */
export function winnerOf(state: State): Seat | null {
  if (state.phase !== 'done') return null
  const [first, second] = standings(state)
  return first.worth === second.worth ? null : (first.index as Seat)
}

export function applyMove(room: Room, seat: Seat, message: Record<string, unknown>): Outcome {
  if (room.state.phase === 'done') return { ok: false, error: 'game-over' }
  if (actor(room.state) !== seat) return { ok: false, error: 'not-your-turn' }
  if (!isAction(message.action)) return { ok: false, error: 'illegal-move' }
  const state = applyAction(room.state, message.action)
  if (state === room.state) return { ok: false, error: 'illegal-move' }
  const wins: [number, number] = [...room.wins]
  const winner = winnerOf(state)
  if (winner !== null) wins[winner]++
  return { ok: true, room: { ...room, state, wins } }
}

/** When both seats have asked, a new trip starts from a fresh seed. */
export function requestRematch(room: Room, seat: Seat): Outcome {
  if (room.state.phase !== 'done') return { ok: false, error: 'game-not-over' }
  const rematch: [boolean, boolean] = [...room.rematch]
  rematch[seat] = true
  if (!(rematch[0] && rematch[1])) return { ok: true, room: { ...room, rematch } }
  return { ok: true, room: { ...newRoom(), round: room.round + 1, wins: room.wins } }
}

/** What one seat is told: everything on the board, but not the seed. */
export function viewFor(room: Room, seat: Seat) {
  const done = room.state.phase === 'done'
  const winner = winnerOf(room.state)
  return {
    you: seat,
    yourColour: seat + 1,
    turn: done ? null : actor(room.state),
    winner,
    draw: done && winner === null,
    round: room.round,
    wins: room.wins,
    rematch: room.rematch,
    board: { ...room.state, seed: '' },
  }
}

const PHASES = ['roll', 'buy', 'auction', 'manage', 'done']
/** Trusts nothing read back from storage. */
export function parseRoom(value: unknown): Room | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as Partial<Room>
  const s = r.state
  if (!s || typeof s !== 'object' || !Array.isArray(s.players) || s.players.length !== 2 || !Array.isArray(s.holdings) || s.holdings.length !== BOARD.length) return null
  if (!PHASES.includes(s.phase) || typeof s.seed !== 'string' || !Number.isSafeInteger(s.turn) || s.turn < 0) return null
  if (!s.players.every((p) => p && Number.isFinite(p.cash) && Number.isInteger(p.position) && p.position >= 0 && p.position < BOARD.length)) return null
  if (!Number.isSafeInteger(r.round) || !Array.isArray(r.wins) || !Array.isArray(r.rematch)) return null
  return r as Room
}
