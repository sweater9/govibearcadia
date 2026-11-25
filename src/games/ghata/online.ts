/**
 * Pure rules for an online Ghata Bara room: two to four people, with the computer playing any board seat nobody
 * holds. Everyone joins a lobby, the host picks the board size and starts, and from then on the server is the only
 * authority: it rolls the dice (clients never send a roll), checks it is that person's turn, applies the same rules
 * the single-device game uses, and plays the computer seats. A person who has gone can be replaced by the computer
 * once their turn is what everyone is waiting for. No React or browser APIs.
 */
import type { Random } from '../../lib/rng'
import { chooseAction } from './bot'
import { HUMAN_SEATS } from './seats'
import { PAWNS_PER_SEAT, apply, dice, newGame, type Action, type GameEvent, type Seat, type Size, type State } from './rules'

export const SEATS = 4
export const MIN_PLAYERS = 2
/** `humanAt[boardSeat]` is the room seat playing it, or null for the computer. `state` is null in the lobby. */
/** `last` is everything that happened since the previous person moved (their action and the computer's replies), so nobody misses a roll. */
export type Room = { state: State | null; humanAt: (number | null)[]; round: number; wins: number[]; rematch: boolean[]; last?: GameEvent[] }
export type Context = { seated: boolean[]; connected: boolean[] }
export type Failure = 'game-over' | 'not-your-turn' | 'illegal-move' | 'game-not-over' | 'not-started' | 'not-host' | 'need-two'
export type Outcome = { ok: true; room: Room } | { ok: false; error: Failure }

const flags = (): boolean[] => Array.from({ length: SEATS }, () => false)
export const newRoom = (): Room => ({ state: null, humanAt: [null, null, null, null], round: 1, wins: [0, 0, 0, 0], rematch: flags() })
export const isOpen = (room: Room): boolean => room.state === null
export const hostOf = (connected: boolean[]): number => connected.findIndex(Boolean)

/** A fair random source for dice and the computer's tie-breaks; the server never uses a guessable seed. */
export const secureRandom: Random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32

/** Room seats `here` take board seats in the usual arrangement (two sit opposite each other). */
export function seatPlayers(here: number[]): (number | null)[] {
  const humanAt: (number | null)[] = [null, null, null, null]
  HUMAN_SEATS[here.length].forEach((boardSeat, i) => (humanAt[boardSeat] = here[i]))
  return humanAt
}

/** Plays every computer seat until it is a person's turn or the game ends. Bounded so a bug cannot spin forever. */
export function autoplay(state: State, humanAt: (number | null)[], random: Random = secureRandom, log?: GameEvent[]): State {
  let s = state
  for (let i = 0; i < 5000 && s.phase !== 'over' && humanAt[s.turn] === null; i++) {
    const r = apply(s, chooseAction(s, random))
    if (!r.ok) break
    s = r.state
    log?.push(...s.events)
  }
  return s
}

const connectedHere = (ctx: Context): number[] => ctx.connected.flatMap((c, i) => (c ? [i] : []))

function deal(size: Size, here: number[], random: Random): { state: State; humanAt: (number | null)[]; last: GameEvent[] } {
  const humanAt = seatPlayers(here)
  const last: GameEvent[] = []
  return { humanAt, state: autoplay(newGame(size), humanAt, random, last), last }
}

const isSize = (v: unknown): v is Size => v === 5 || v === 7

export function startGame(room: Room, seat: number, message: Record<string, unknown>, ctx: Context, random: Random = secureRandom): Outcome {
  if (room.state) return { ok: false, error: 'illegal-move' }
  if (seat !== hostOf(ctx.connected)) return { ok: false, error: 'not-host' }
  const here = connectedHere(ctx)
  if (here.length < MIN_PLAYERS) return { ok: false, error: 'need-two' }
  const size = message.size === undefined ? 7 : message.size
  if (!isSize(size)) return { ok: false, error: 'illegal-move' }
  return { ok: true, room: { ...room, ...deal(size, here, random), rematch: flags() } }
}

const isChunks = (v: unknown): v is number[] => Array.isArray(v) && v.length >= 1 && v.length <= 12 && v.every((n) => Number.isInteger(n) && n >= 0 && n < 100)

/** Only the shapes a person may send; dice are never one of them. */
export function toAction(message: Record<string, unknown>, random: Random): Action | null {
  const a = message.action
  if (a === 'roll') return { type: 'roll', dice: dice(random) }
  if (a === 'release') return Number.isInteger(message.chunk) && (message.chunk as number) >= 0 && (message.chunk as number) < 12 ? { type: 'release', chunk: message.chunk as number } : null
  if (a === 'move') {
    const id = message.id
    if ((message.kind !== 'pawn' && message.kind !== 'juga') || !Number.isInteger(id) || (id as number) < 0 || (id as number) >= SEATS * PAWNS_PER_SEAT || !isChunks(message.chunks)) return null
    return { type: 'move', kind: message.kind, id: id as number, chunks: message.chunks }
  }
  return null
}

export function winnerOf(room: Room): number | null {
  const s = room.state
  return s?.winner === null || s?.winner === undefined ? null : room.humanAt[s.winner]
}

function finish(room: Room, state: State): Room {
  const next = { ...room, state }
  const winner = winnerOf(next)
  if (room.state?.phase !== 'over' && winner !== null) {
    const wins = room.wins.slice()
    wins[winner]++
    next.wins = wins
  }
  return next
}

export function applyMove(room: Room, seat: number, message: Record<string, unknown>, random: Random = secureRandom): Outcome {
  const s = room.state
  if (!s) return { ok: false, error: 'not-started' }
  if (s.phase === 'over') return { ok: false, error: 'game-over' }
  if (room.humanAt[s.turn] !== seat) return { ok: false, error: 'not-your-turn' }
  const action = toAction(message, random)
  if (!action) return { ok: false, error: 'illegal-move' }
  const r = apply(s, action)
  if (!r.ok) return { ok: false, error: 'illegal-move' }
  const last: GameEvent[] = [...r.state.events]
  return { ok: true, room: { ...finish(room, autoplay(r.state, room.humanAt, random, last)), last: last.slice(-30) } }
}

/** Hands a person who has gone to the computer, but only when their turn is what everyone is waiting for. */
export function replaceAbsent(room: Room, seat: number, message: Record<string, unknown>, ctx: Context, random: Random = secureRandom): Outcome {
  const s = room.state
  if (!s) return { ok: false, error: 'not-started' }
  if (s.phase === 'over') return { ok: false, error: 'game-over' }
  const target = message.seat
  if (typeof target !== 'number' || !Number.isInteger(target) || target === seat || room.humanAt[s.turn] !== target || ctx.connected[target]) return { ok: false, error: 'illegal-move' }
  if (room.humanAt[s.turn] === null) return { ok: false, error: 'illegal-move' }
  const humanAt = room.humanAt.map((h) => (h === target ? null : h))
  if (!humanAt.some((h) => h !== null)) return { ok: false, error: 'illegal-move' }
  const last: GameEvent[] = []
  return { ok: true, room: { ...finish({ ...room, humanAt }, autoplay(s, humanAt, random, last)), last: last.slice(-30) } }
}

/** When every player who is here has asked, a new game starts from the lobby's seats. */
export function requestRematch(room: Room, seat: number, ctx: Context, random: Random = secureRandom): Outcome {
  const s = room.state
  if (!s || s.phase !== 'over') return { ok: false, error: 'game-not-over' }
  const rematch = room.rematch.slice()
  rematch[seat] = true
  const here = connectedHere(ctx)
  if (here.length < MIN_PLAYERS || !here.every((i) => rematch[i])) return { ok: true, room: { ...room, rematch } }
  return { ok: true, room: { ...room, ...deal(s.size, here, random), round: room.round + 1, rematch: flags() } }
}

/** What one seat is told. Nothing in a Ghata game is hidden, so the board goes out whole. */
export function viewFor(room: Room, seat: number, ctx?: Context) {
  const s = room.state
  const over = s?.phase === 'over'
  const mine = room.humanAt.indexOf(seat)
  const owner = s && !over ? room.humanAt[s.turn] : null
  return {
    you: seat,
    /** The board seat this person plays, or null when they are only watching. */
    yourSeat: mine < 0 ? null : mine,
    playing: mine >= 0,
    yourColour: mine < 0 ? 0 : mine + 1,
    lobby: !s,
    host: ctx ? hostOf(ctx.connected) : 0,
    seated: ctx ? ctx.seated.filter(Boolean).length : 0,
    /** The room seat to move, or null when the game is over or the computer is moving (it never waits). */
    turn: !s || over ? null : owner,
    winner: winnerOf(room),
    computerWon: !!over && winnerOf(room) === null,
    draw: false,
    round: room.round,
    wins: room.wins,
    rematch: room.rematch,
    humanAt: room.humanAt,
    last: room.last ?? [],
    board: s,
  }
}

/** Trusts nothing read back from storage. */
export function parseRoom(value: unknown): Room | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as Partial<Room>
  if (!Number.isSafeInteger(r.round) || !Array.isArray(r.wins) || r.wins.length !== SEATS || !Array.isArray(r.rematch) || r.rematch.length !== SEATS) return null
  if (!Array.isArray(r.humanAt) || r.humanAt.length !== SEATS || !r.humanAt.every((h) => h === null || (Number.isInteger(h) && (h as number) >= 0 && (h as number) < SEATS))) return null
  const s = r.state
  if (r.last !== undefined && !Array.isArray(r.last)) return null
  if (s === null) return r as Room
  if (!s || typeof s !== 'object' || !isSize(s.size) || !Array.isArray(s.pawns) || s.pawns.length !== SEATS * PAWNS_PER_SEAT || !Array.isArray(s.jugas)) return null
  if (!['roll', 'move', 'over'].includes(s.phase) || !Number.isInteger(s.turn) || s.turn < 0 || s.turn > 3 || !Array.isArray(s.queue) || !Array.isArray(s.rolls)) return null
  return r as Room
}

export type { Seat }
