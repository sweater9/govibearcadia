/**
 * Every game that can be played in an online room, behind one interface so the Worker does not care which it is.
 * Pure: no React or browser APIs.
 */
import { createOnline, type Kit, type Seat } from '../lib/onlineRoom'
import * as c4 from './connect4/online'
import * as bs from './battleship/rules'
import * as ck from './checkers/rules'
import * as ttt from './tictactoe/rules'
import * as wt from './worldtrip/online'

export type Message = Record<string, unknown>
export type Result = { ok: true; room: unknown } | { ok: false; error: string }
/** Which seats have been claimed and which are connected right now, for games where that matters (World Trip's lobby). */
export type SeatContext = { seated: boolean[]; connected: boolean[] }
export type OnlineGame = {
  /** How many seats a room has. Two unless the game says otherwise. */
  seats?: number
  newRoom(): unknown
  /** Whether a seat that nobody has claimed yet can still be taken. Defaults to true. */
  open?(room: unknown): boolean
  move(room: unknown, seat: number, message: Message): Result
  rematch(room: unknown, seat: number, ctx: SeatContext): Result
  view(room: unknown, seat: number, ctx: SeatContext): object
  parse(value: unknown): unknown
  /** Extra message types this game understands besides move and rematch (e.g. Battleship's shuffle and ready). */
  extra?: string[]
  act?(room: unknown, seat: number, message: Message, ctx: SeatContext): Result
}

function fromKit<S>(kit: Kit<S>): OnlineGame {
  const o = createOnline(kit)
  const need = (room: unknown) => room as ReturnType<typeof o.newRoom>
  return {
    newRoom: o.newRoom,
    move: (room, seat, message) => o.applyMove(need(room), seat as Seat, message),
    rematch: (room, seat) => o.requestRematch(need(room), seat as Seat),
    view: (room, seat) => o.viewFor(need(room), seat as Seat),
    parse: o.parseRoom,
  }
}

const tictactoe = fromKit<ttt.TState>({
  initial: ttt.newGame,
  turn: (s) => s.turn,
  winner: (s) => s.winner,
  draw: (s) => s.draw,
  play: (s, m) => ttt.play(s, m.cell),
  isState: ttt.isState,
})

const checkers = fromKit<ck.CState>({
  initial: ck.newGame,
  turn: (s) => s.turn,
  winner: (s) => s.winner,
  draw: (s) => s.draw,
  play: (s, m) => ck.step(s, m.from, m.to),
  isState: ck.isState,
})

const connectFour: OnlineGame = {
  newRoom: c4.newRoom,
  move: (room, seat, m) => c4.applyMove(room as c4.Room, seat as Seat, m.col),
  rematch: (room, seat) => c4.requestRematch(room as c4.Room, seat as Seat),
  view: (room, seat) => c4.viewFor(room as c4.Room, seat as Seat),
  parse: c4.parseRoom,
}

const battleship: OnlineGame = {
  newRoom: () => bs.newRoom(),
  move: (room, seat, m) => bs.act(room as bs.Room, seat as Seat, m),
  rematch: (room, seat) => bs.act(room as bs.Room, seat as Seat, { type: 'rematch' }),
  view: (room, seat) => bs.viewFor(room as bs.Room, seat as Seat),
  parse: bs.parseRoom,
  extra: ['shuffle', 'ready'],
  act: (room, seat, m) => bs.act(room as bs.Room, seat as Seat, m),
}

const worldTrip: OnlineGame = {
  seats: wt.SEATS,
  newRoom: () => wt.newRoom(),
  open: (room) => wt.isOpen(room as wt.Room),
  move: (room, seat, m) => wt.applyMove(room as wt.Room, seat, m),
  rematch: (room, seat, ctx) => wt.requestRematch(room as wt.Room, seat, ctx),
  view: (room, seat, ctx) => wt.viewFor(room as wt.Room, seat, ctx),
  parse: wt.parseRoom,
  extra: ['start', 'remove'],
  act: (room, seat, m, ctx) => (m.type === 'start' ? wt.startTrip(room as wt.Room, seat, ctx) : wt.removeAbsent(room as wt.Room, seat, m, ctx)),
}

export const ONLINE_GAMES: Record<string, OnlineGame> = { 'connect-four': connectFour, 'tic-tac-toe': tictactoe, checkers, battleship, 'world-trip': worldTrip }
export const ONLINE_GAME_IDS = Object.keys(ONLINE_GAMES)
