/**
 * Pure rules for an online Connect Four room: seats, turns, results and rematches. The Worker runs this and is
 * the only authority; clients just send intentions ("drop in column 3") and render what they are told.
 * No React or browser APIs.
 */
import { COLS, drop, dropRow, isOver, newGame, type C4State, type Cell, type Player } from './rules'

export type Seat = 0 | 1
export const seatOther = (s: Seat): Seat => (s === 0 ? 1 : 0)

export type Room = {
  game: C4State
  /** The seat that plays red and moves first this round. It alternates every round. */
  starter: Seat
  round: number
  /** Round wins per seat. */
  wins: [number, number]
  /** Who has asked for a rematch since the last round ended. */
  rematch: [boolean, boolean]
}

export const newRoom = (): Room => ({ game: newGame(), starter: 0, round: 1, wins: [0, 0], rematch: [false, false] })

/** Which colour (C4 player 1 or 2) a seat plays this round. */
export const colourOf = (room: Pick<Room, 'starter'>, seat: Seat): Player => (room.starter === seat ? 1 : 2)
export const seatOfColour = (room: Pick<Room, 'starter'>, colour: Player): Seat => (colour === 1 ? room.starter : seatOther(room.starter))

export type Failure = 'game-over' | 'not-your-turn' | 'illegal-move' | 'game-not-over'
export type Outcome = { ok: true; room: Room } | { ok: false; error: Failure }

export function applyMove(room: Room, seat: Seat, col: unknown): Outcome {
  if (isOver(room.game)) return { ok: false, error: 'game-over' }
  if (colourOf(room, seat) !== room.game.turn) return { ok: false, error: 'not-your-turn' }
  if (typeof col !== 'number' || !Number.isInteger(col) || col < 0 || col >= COLS || dropRow(room.game.cells, col) < 0) return { ok: false, error: 'illegal-move' }
  const game = drop(room.game, col)
  const wins: [number, number] = [...room.wins]
  if (game.winner) wins[seatOfColour(room, game.winner)]++
  return { ok: true, room: { ...room, game, wins } }
}

/** Records a rematch request; when both seats have asked, a new round starts and the other seat goes first. */
export function requestRematch(room: Room, seat: Seat): Outcome {
  if (!isOver(room.game)) return { ok: false, error: 'game-not-over' }
  const rematch: [boolean, boolean] = [...room.rematch]
  rematch[seat] = true
  if (!(rematch[0] && rematch[1])) return { ok: true, room: { ...room, rematch } }
  return { ok: true, room: { game: newGame(), starter: seatOther(room.starter), round: room.round + 1, wins: room.wins, rematch: [false, false] } }
}

/** What one seat is told. Nothing hidden exists in Connect Four, but the view is built per seat so later games can hide things. */
export type View = {
  you: Seat
  yourColour: Player
  cells: Cell[]
  /** The seat to move, or null once the round is over. */
  turn: Seat | null
  winner: Seat | null
  draw: boolean
  line: number[] | null
  moves: number
  round: number
  wins: [number, number]
  rematch: [boolean, boolean]
}

export function viewFor(room: Room, seat: Seat): View {
  const over = isOver(room.game)
  return {
    you: seat,
    yourColour: colourOf(room, seat),
    cells: room.game.cells,
    turn: over ? null : seatOfColour(room, room.game.turn),
    winner: room.game.winner ? seatOfColour(room, room.game.winner) : null,
    draw: room.game.draw,
    line: room.game.line,
    moves: room.game.moves,
    round: room.round,
    wins: room.wins,
    rematch: room.rematch,
  }
}

/** Trusts nothing read back from storage. */
export function parseRoom(value: unknown): Room | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as Partial<Room>
  const g = r.game
  if (!g || !Array.isArray(g.cells) || g.cells.length !== 42 || !g.cells.every((c) => c === 0 || c === 1 || c === 2)) return null
  if ((r.starter !== 0 && r.starter !== 1) || typeof r.round !== 'number' || !Array.isArray(r.wins) || !Array.isArray(r.rematch)) return null
  return r as Room
}
