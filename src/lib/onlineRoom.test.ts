import { describe, expect, it } from 'vitest'
import { ONLINE_GAMES } from '../games/onlineGames'

describe.each(['tic-tac-toe', 'checkers'])('online %s', (id) => {
  const g = ONLINE_GAMES[id]
  it('gives each seat its own colour and lets only the player to move act', () => {
    const room = g.newRoom()
    expect(g.view(room, 0)).toMatchObject({ you: 0, yourColour: 1, turn: 0 })
    expect(g.view(room, 1)).toMatchObject({ you: 1, yourColour: 2, turn: 0 })
    expect(g.move(room, 1, { type: 'move', cell: 0, from: 17, to: 24 })).toEqual({ ok: false, error: 'not-your-turn' })
    expect(g.rematch(room, 0)).toEqual({ ok: false, error: 'game-not-over' })
  })
  it('rejects nonsense moves and survives storage round trips', () => {
    const room = g.newRoom()
    expect(g.move(room, 0, { type: 'move', cell: 'x', from: 'x', to: null })).toEqual({ ok: false, error: 'illegal-move' })
    expect(g.parse(JSON.parse(JSON.stringify(room)))).toEqual(room)
    expect(g.parse({ ...(room as object), state: { cells: [] } })).toBeNull()
    expect(g.parse(null)).toBeNull()
  })
})

describe('online tic-tac-toe play', () => {
  const g = ONLINE_GAMES['tic-tac-toe']
  const play = (room: unknown, seat: 0 | 1, cell: number) => {
    const r = g.move(room, seat, { type: 'move', cell })
    if (!r.ok) throw new Error(r.error)
    return r.room
  }
  it('counts a win, then a rematch swaps who starts and keeps the tally', () => {
    let room = g.newRoom()
    for (const [seat, cell] of [[0, 0], [1, 3], [0, 1], [1, 4], [0, 2]] as const) room = play(room, seat, cell)
    expect(g.view(room, 0)).toMatchObject({ turn: null, winner: 0, wins: [1, 0] })
    expect(g.move(room, 1, { type: 'move', cell: 8 })).toEqual({ ok: false, error: 'game-over' })
    const one = g.rematch(room, 0)
    expect(one.ok && g.view(one.room, 0)).toMatchObject({ round: 1, rematch: [true, false] })
    const two = g.rematch(one.ok ? one.room : null, 1)
    expect(two.ok && g.view(two.room, 1)).toMatchObject({ round: 2, turn: 1, yourColour: 1, wins: [1, 0] })
  })
})

describe('online checkers play', () => {
  const g = ONLINE_GAMES.checkers
  it('moves a piece, and the view carries the board for rendering', () => {
    const r = g.move(g.newRoom(), 0, { type: 'move', from: 40, to: 33 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(g.view(r.room, 1)).toMatchObject({ turn: 1, board: { turn: 2 } })
  })
})

describe('online battleship through the Worker interface', () => {
  const g = ONLINE_GAMES.battleship
  it('takes shuffle and ready as extra messages, then plays and never leaks the other fleet', () => {
    expect(g.extra).toEqual(['shuffle', 'ready'])
    let room = g.newRoom()
    for (const seat of [0, 1] as const) {
      const r = g.act!(room, seat, { type: 'ready' })
      if (!r.ok) throw new Error(r.error)
      room = r.room
    }
    const mine = (g.view(room, 0) as { board: { fleet: number[][]; reveal: unknown } }).board
    const theirs = (g.view(room, 1) as { board: { fleet: number[][] } }).board
    expect(JSON.stringify(g.view(room, 0))).not.toContain(JSON.stringify(theirs.fleet))
    expect(JSON.stringify(g.view(room, 1))).not.toContain(JSON.stringify(mine.fleet))
    expect(mine.reveal).toBeNull()
  })
})
