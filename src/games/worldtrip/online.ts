/**
 * Pure rules for an online World Trip room: two to six travellers. Everyone joins a lobby, the host starts the trip,
 * and from then on the server is the only authority. Clients send an action ("roll", "bid 40"); the server checks it
 * is that seat's move and applies the same rules the single-device game uses. The dice seed never leaves the server,
 * so nobody can read the next roll. A traveller who has gone can be removed once their move is holding the others up.
 * No React or browser APIs.
 */
import { actor } from './bot'
import { isAction } from './actions'
import { BOARD } from './board'
import { applyAction, DEFAULT_TURNS, MAX_PLAYERS, MIN_PLAYERS, newGame, removePlayer, standings, type State } from './rules'

export const SEATS = MAX_PLAYERS
/** `state` is null until the host starts the trip (the lobby). */
export type Room = { state: State | null; round: number; wins: number[]; rematch: boolean[] }
/** What the Worker knows about the seats: who has claimed one, and who is connected right now. */
export type Context = { seated: boolean[]; connected: boolean[] }
export type Failure = 'game-over' | 'not-your-turn' | 'illegal-move' | 'game-not-over' | 'not-started' | 'not-host' | 'need-two'
export type Outcome = { ok: true; room: Room } | { ok: false; error: Failure }

const flags = (): boolean[] => Array.from({ length: SEATS }, () => false)
export const newRoom = (): Room => ({ state: null, round: 1, wins: Array.from({ length: SEATS }, () => 0), rematch: flags() })

/** A new room can be joined until the trip starts. Seats already claimed can always come back. */
export const isOpen = (room: Room): boolean => room.state === null

/** The host is the lowest-numbered traveller who is here, so a room is never stuck waiting for someone who left. */
export const hostOf = (connected: boolean[]): number => connected.findIndex(Boolean)

/** The seat that won a finished trip, or null when the top net worth is shared. Travellers who left cannot win. */
export function winnerOf(state: State): number | null {
  if (state.phase !== 'done') return null
  const ranked = standings(state).filter((p) => !state.players[p.index].out)
  if (!ranked.length) return null
  return ranked.length > 1 && ranked[0].worth === ranked[1].worth ? null : ranked[0].index
}

/** Dealt to however many seats were claimed; anyone not connected at the start is already out. */
function deal(count: number, connected: boolean[], seed: string): State {
  const s = newGame(count, seed, DEFAULT_TURNS)
  return { ...s, players: s.players.map((p, i) => (connected[i] ? p : { ...p, out: true, cash: 0 })) }
}

/** The host starts the trip once at least two travellers are here. */
export function startTrip(room: Room, seat: number, ctx: Context, seed: string = crypto.randomUUID()): Outcome {
  if (room.state) return { ok: false, error: 'illegal-move' }
  if (seat !== hostOf(ctx.connected)) return { ok: false, error: 'not-host' }
  if (ctx.connected.filter(Boolean).length < MIN_PLAYERS) return { ok: false, error: 'need-two' }
  const count = ctx.seated.lastIndexOf(true) + 1
  return { ok: true, room: { ...room, state: deal(count, ctx.connected, seed), rematch: flags() } }
}

export function applyMove(room: Room, seat: number, message: Record<string, unknown>): Outcome {
  if (!room.state) return { ok: false, error: 'not-started' }
  if (room.state.phase === 'done') return { ok: false, error: 'game-over' }
  if (actor(room.state) !== seat) return { ok: false, error: 'not-your-turn' }
  if (!isAction(message.action)) return { ok: false, error: 'illegal-move' }
  const state = applyAction(room.state, message.action)
  if (state === room.state) return { ok: false, error: 'illegal-move' }
  return { ok: true, room: finish(room, state) }
}

/** Takes a traveller who has gone out of the trip, but only when their move is what everyone is waiting for. */
export function removeAbsent(room: Room, seat: number, message: Record<string, unknown>, ctx: Context): Outcome {
  const target = message.seat
  const state = room.state
  if (!state) return { ok: false, error: 'not-started' }
  if (state.phase === 'done') return { ok: false, error: 'game-over' }
  if (typeof target !== 'number' || !Number.isInteger(target) || target < 0 || target >= state.players.length || target === seat) return { ok: false, error: 'illegal-move' }
  if (ctx.connected[target] || state.players[target].out || actor(state) !== target) return { ok: false, error: 'illegal-move' }
  const next = removePlayer(state, target)
  return next === state ? { ok: false, error: 'illegal-move' } : { ok: true, room: finish(room, next) }
}

function finish(room: Room, state: State): Room {
  const wins = room.wins.slice()
  const winner = winnerOf(state)
  if (room.state?.phase !== 'done' && winner !== null) wins[winner]++
  return { ...room, state, wins }
}

/** When every traveller who is here has asked, a new trip starts from a fresh seed with the same seats. */
export function requestRematch(room: Room, seat: number, ctx: Context, seed: string = crypto.randomUUID()): Outcome {
  if (!room.state || room.state.phase !== 'done') return { ok: false, error: 'game-not-over' }
  const rematch = room.rematch.slice()
  rematch[seat] = true
  const here = ctx.connected.flatMap((c, i) => (c ? [i] : []))
  if (here.length < MIN_PLAYERS || !here.every((i) => rematch[i])) return { ok: true, room: { ...room, rematch } }
  return { ok: true, room: { ...room, state: deal(room.state.players.length, ctx.connected, seed), round: room.round + 1, rematch: flags() } }
}

/** What one seat is told: everything on the board, but not the seed. */
export function viewFor(room: Room, seat: number, ctx?: Context) {
  const state = room.state
  const done = state?.phase === 'done'
  const winner = state ? winnerOf(state) : null
  return {
    you: seat,
    yourColour: seat + 1,
    lobby: !state,
    host: ctx ? hostOf(ctx.connected) : 0,
    seated: ctx ? ctx.seated.filter(Boolean).length : 0,
    turn: !state || done ? null : actor(state),
    winner,
    draw: !!done && winner === null,
    round: room.round,
    wins: room.wins,
    rematch: room.rematch,
    board: state ? { ...state, seed: '' } : null,
  }
}

const PHASES = ['roll', 'buy', 'auction', 'manage', 'done']
/** Trusts nothing read back from storage. */
export function parseRoom(value: unknown): Room | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as Partial<Room>
  if (!Number.isSafeInteger(r.round) || !Array.isArray(r.wins) || r.wins.length !== SEATS || !Array.isArray(r.rematch) || r.rematch.length !== SEATS) return null
  const s = r.state
  if (s === null) return r as Room
  if (!s || typeof s !== 'object' || !Array.isArray(s.players) || s.players.length < MIN_PLAYERS || s.players.length > MAX_PLAYERS || !Array.isArray(s.holdings) || s.holdings.length !== BOARD.length) return null
  if (!PHASES.includes(s.phase) || typeof s.seed !== 'string' || !Number.isSafeInteger(s.turn) || s.turn < 0) return null
  if (!s.players.every((p) => p && Number.isFinite(p.cash) && Number.isInteger(p.position) && p.position >= 0 && p.position < BOARD.length)) return null
  return r as Room
}
