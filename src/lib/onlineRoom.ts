/**
 * The shared shape of an online room for any two-player turn-based game: seats, who moves first, round wins and
 * rematches. A game supplies a `Kit` of pure rules; the Worker runs it and is the only authority. No React or
 * browser APIs.
 */
export type Seat = 0 | 1
export type Player = 1 | 2
export const seatOther = (s: Seat): Seat => (s === 0 ? 1 : 0)

export type Kit<S> = {
  initial(): S
  /** Which player (1 moves first) is to move. */
  turn(s: S): Player
  winner(s: S): 0 | Player
  draw(s: S): boolean
  /** Applies a client message ({type: 'move', ...}) for the player to move. Returns the same object when illegal. */
  play(s: S, message: Record<string, unknown>): S
  isState(v: unknown): v is S
}

export type GRoom<S> = {
  state: S
  /** The seat that is player 1 and moves first this round. It alternates every round. */
  starter: Seat
  round: number
  wins: [number, number]
  rematch: [boolean, boolean]
}

export type Failure = 'game-over' | 'not-your-turn' | 'illegal-move' | 'game-not-over'
export type Outcome<S> = { ok: true; room: GRoom<S> } | { ok: false; error: Failure }

export type GView<S> = {
  you: Seat
  yourColour: Player
  turn: Seat | null
  winner: Seat | null
  draw: boolean
  round: number
  wins: [number, number]
  rematch: [boolean, boolean]
  board: S
}

export function createOnline<S>(kit: Kit<S>) {
  const over = (s: S) => kit.winner(s) !== 0 || kit.draw(s)
  const colourOf = (room: Pick<GRoom<S>, 'starter'>, seat: Seat): Player => (room.starter === seat ? 1 : 2)
  const seatOfColour = (room: Pick<GRoom<S>, 'starter'>, colour: Player): Seat => (colour === 1 ? room.starter : seatOther(room.starter))

  const newRoom = (): GRoom<S> => ({ state: kit.initial(), starter: 0, round: 1, wins: [0, 0], rematch: [false, false] })

  function applyMove(room: GRoom<S>, seat: Seat, message: Record<string, unknown>): Outcome<S> {
    if (over(room.state)) return { ok: false, error: 'game-over' }
    if (colourOf(room, seat) !== kit.turn(room.state)) return { ok: false, error: 'not-your-turn' }
    const state = kit.play(room.state, message)
    if (state === room.state) return { ok: false, error: 'illegal-move' }
    const wins: [number, number] = [...room.wins]
    const w = kit.winner(state)
    if (w) wins[seatOfColour(room, w)]++
    return { ok: true, room: { ...room, state, wins } }
  }

  /** When both seats have asked, a new round starts and the other seat goes first. */
  function requestRematch(room: GRoom<S>, seat: Seat): Outcome<S> {
    if (!over(room.state)) return { ok: false, error: 'game-not-over' }
    const rematch: [boolean, boolean] = [...room.rematch]
    rematch[seat] = true
    if (!(rematch[0] && rematch[1])) return { ok: true, room: { ...room, rematch } }
    return { ok: true, room: { state: kit.initial(), starter: seatOther(room.starter), round: room.round + 1, wins: room.wins, rematch: [false, false] } }
  }

  function viewFor(room: GRoom<S>, seat: Seat): GView<S> {
    const done = over(room.state)
    const w = kit.winner(room.state)
    return {
      you: seat,
      yourColour: colourOf(room, seat),
      turn: done ? null : seatOfColour(room, kit.turn(room.state)),
      winner: w ? seatOfColour(room, w) : null,
      draw: kit.draw(room.state),
      round: room.round,
      wins: room.wins,
      rematch: room.rematch,
      board: room.state,
    }
  }

  /** Trusts nothing read back from storage. */
  function parseRoom(value: unknown): GRoom<S> | null {
    if (typeof value !== 'object' || value === null) return null
    const r = value as Partial<GRoom<S>>
    if (!kit.isState(r.state)) return null
    if ((r.starter !== 0 && r.starter !== 1) || typeof r.round !== 'number' || !Array.isArray(r.wins) || !Array.isArray(r.rematch)) return null
    return r as GRoom<S>
  }

  return { newRoom, applyMove, requestRematch, viewFor, parseRoom }
}
