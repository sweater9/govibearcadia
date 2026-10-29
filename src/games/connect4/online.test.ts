import { describe, expect, it } from 'vitest'
import { applyMove, colourOf, newRoom, parseRoom, requestRematch, seatOfColour, viewFor, type Room, type Seat } from './online'

const play = (room: Room, moves: [Seat, number][]): Room =>
  moves.reduce((r, [seat, col]) => {
    const out = applyMove(r, seat, col)
    if (!out.ok) throw new Error(`${out.error} at ${seat}:${col}`)
    return out.room
  }, room)

/** Seat 0 (red, moves first) stacks column 0; seat 1 answers in column 1. Red wins on its fourth piece. */
const redWins: [Seat, number][] = [[0, 0], [1, 1], [0, 0], [1, 1], [0, 0], [1, 1], [0, 0]]

describe('online Connect Four room', () => {
  it('seat 0 is red and moves first; only the seat to move can move', () => {
    const room = newRoom()
    expect(colourOf(room, 0)).toBe(1)
    expect(colourOf(room, 1)).toBe(2)
    expect(applyMove(room, 1, 3)).toEqual({ ok: false, error: 'not-your-turn' })
    expect(applyMove(room, 0, 3).ok).toBe(true)
  })

  it('rejects illegal columns and values without changing anything', () => {
    const room = newRoom()
    for (const bad of [-1, 7, 1.5, NaN, '3', null, undefined, {}, [3]]) expect(applyMove(room, 0, bad)).toEqual({ ok: false, error: 'illegal-move' })
    const full = play(room, [[0, 0], [1, 0], [0, 0], [1, 0], [0, 0], [1, 0]])
    expect(applyMove(full, 0, 0)).toEqual({ ok: false, error: 'illegal-move' }) // column 0 is full
  })

  it('a win ends the round, counts for the winning seat, and blocks further moves', () => {
    const room = play(newRoom(), redWins)
    expect(room.game.winner).toBe(1)
    expect(room.wins).toEqual([1, 0])
    expect(applyMove(room, 1, 2)).toEqual({ ok: false, error: 'game-over' })
    const view = viewFor(room, 1)
    expect(view).toMatchObject({ you: 1, yourColour: 2, turn: null, winner: 0, round: 1, wins: [1, 0] })
    expect(view.line).toHaveLength(4)
  })

  it('a rematch needs both seats, then the other seat starts and keeps the tally', () => {
    let room = play(newRoom(), redWins)
    expect(requestRematch(newRoom(), 0)).toEqual({ ok: false, error: 'game-not-over' })
    const first = requestRematch(room, 0)
    if (!first.ok) throw new Error('rematch failed')
    room = first.room
    expect(room.round).toBe(1) // waiting for the other seat
    expect(room.rematch).toEqual([true, false])
    expect(requestRematch(room, 0)).toMatchObject({ ok: true, room: { round: 1 } }) // asking twice does not start it
    const second = requestRematch(room, 1)
    if (!second.ok) throw new Error('rematch failed')
    room = second.room
    expect(room).toMatchObject({ round: 2, starter: 1, wins: [1, 0], rematch: [false, false] })
    expect(colourOf(room, 1)).toBe(1)
    expect(applyMove(room, 0, 3)).toEqual({ ok: false, error: 'not-your-turn' })
    expect(viewFor(room, 1).turn).toBe(1)
    expect(seatOfColour(room, 1)).toBe(1)
  })

  it('wins go to the right seat when seat 1 started the round', () => {
    let room = play(newRoom(), redWins)
    for (const seat of [0, 1] as const) {
      const out = requestRematch(room, seat)
      if (out.ok) room = out.room
    }
    room = play(room, redWins.map(([s, c]) => [s === 0 ? 1 : 0, c] as [Seat, number]))
    expect(room.wins).toEqual([1, 1])
  })

  it('a full board with no line is a draw and counts for nobody', () => {
    const columns = [...'000000111111222222433333344444555555666666'].map(Number)
    const room = play(newRoom(), columns.map((c, i) => [(i % 2) as Seat, c]))
    expect(room.game.draw).toBe(true)
    expect(room.wins).toEqual([0, 0])
    expect(viewFor(room, 0)).toMatchObject({ draw: true, winner: null, turn: null })
    expect(applyMove(room, 0, 0)).toEqual({ ok: false, error: 'game-over' })
  })

  it('parseRoom distrusts bad storage', () => {
    expect(parseRoom(null)).toBeNull()
    expect(parseRoom({})).toBeNull()
    expect(parseRoom({ ...newRoom(), game: { ...newRoom().game, cells: [1, 2] } })).toBeNull()
    expect(parseRoom({ ...newRoom(), starter: 2 })).toBeNull()
    expect(parseRoom(JSON.parse(JSON.stringify(newRoom())))).toEqual(newRoom())
  })
})
