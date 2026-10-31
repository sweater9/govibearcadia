/**
 * Every game that can be played in an online room, behind one interface so the Worker does not care which it is.
 * Pure: no React or browser APIs.
 */
import { createOnline, type Kit, type Seat } from '../lib/onlineRoom'
import * as c4 from './connect4/online'
import * as bs from './battleship/rules'
import * as ck from './checkers/rules'
import * as ttt from './tictactoe/rules'

export type Message = Record<string, unknown>
export type Result = { ok: true; room: unknown } | { ok: false; error: string }
export type OnlineGame = {
  newRoom(): unknown
  move(room: unknown, seat: Seat, message: Message): Result
  rematch(room: unknown, seat: Seat): Result
  view(room: unknown, seat: Seat): object
  parse(value: unknown): unknown
  /** Extra message types this game understands besides move and rematch (e.g. Battleship's shuffle and ready). */
  extra?: string[]
  act?(room: unknown, seat: Seat, message: Message): Result
}

function fromKit<S>(kit: Kit<S>): OnlineGame {
  const o = createOnline(kit)
  const need = (room: unknown) => room as ReturnType<typeof o.newRoom>
  return {
    newRoom: o.newRoom,
    move: (room, seat, message) => o.applyMove(need(room), seat, message),
    rematch: (room, seat) => o.requestRematch(need(room), seat),
    view: (room, seat) => o.viewFor(need(room), seat),
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
  move: (room, seat, m) => c4.applyMove(room as c4.Room, seat, m.col),
  rematch: (room, seat) => c4.requestRematch(room as c4.Room, seat),
  view: (room, seat) => c4.viewFor(room as c4.Room, seat),
  parse: c4.parseRoom,
}

const battleship: OnlineGame = {
  newRoom: () => bs.newRoom(),
  move: (room, seat, m) => bs.act(room as bs.Room, seat, m),
  rematch: (room, seat) => bs.act(room as bs.Room, seat, { type: 'rematch' }),
  view: (room, seat) => bs.viewFor(room as bs.Room, seat),
  parse: bs.parseRoom,
  extra: ['shuffle', 'ready'],
  act: (room, seat, m) => bs.act(room as bs.Room, seat, m),
}

export const ONLINE_GAMES: Record<string, OnlineGame> = { 'connect-four': connectFour, 'tic-tac-toe': tictactoe, checkers, battleship }
export const ONLINE_GAME_IDS = Object.keys(ONLINE_GAMES)
