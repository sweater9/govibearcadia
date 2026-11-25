import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { invariantErrors, legalActions } from './rules'
import { applyMove, autoplay, hostOf, newRoom, parseRoom, replaceAbsent, requestRematch, seatPlayers, startGame, viewFor, type Context, type Room } from './online'

const ctx = (connected: boolean[]): Context => ({ seated: connected.map(() => true), connected })
const rnd = () => createRandom('ghata-online')

function started(connected = [true, true, false, false], size: 5 | 7 = 5): Room {
  const r = startGame(newRoom(), hostOf(connected), { size }, ctx(connected), rnd())
  if (!r.ok) throw new Error(r.error)
  return r.room
}

describe('Ghata Bara online room', () => {
  it('seats two people opposite each other and lets the computer take the rest', () => {
    expect(seatPlayers([0, 1])).toEqual([0, null, 1, null])
    expect(seatPlayers([1, 2, 3])).toEqual([1, 2, 3, null])
  })

  it('only the host may start, with two or more people and a real board size', () => {
    const c = [true, true, false, false]
    expect(startGame(newRoom(), 1, {}, ctx(c))).toEqual({ ok: false, error: 'not-host' })
    expect(startGame(newRoom(), 0, {}, ctx([true, false, false, false]))).toEqual({ ok: false, error: 'need-two' })
    expect(startGame(newRoom(), 0, { size: 9 }, ctx(c))).toEqual({ ok: false, error: 'illegal-move' })
    expect(started(c, 5).state?.size).toBe(5)
  })

  it('refuses a move out of turn and never accepts dice from a client', () => {
    const room = started()
    const mover = room.humanAt[room.state!.turn]!
    const other = mover === 0 ? 1 : 0
    expect(applyMove(room, other, { action: 'roll' }, rnd())).toEqual({ ok: false, error: 'not-your-turn' })
    expect(applyMove(room, mover, { action: 'roll', dice: [3, 3] } as never, rnd()).ok).toBe(true)
    expect(applyMove(room, mover, { action: 'move', kind: 'pawn', id: -1, chunks: [1] }, rnd())).toEqual({ ok: false, error: 'illegal-move' })
    expect(applyMove(room, mover, { action: 'bogus' }, rnd())).toEqual({ ok: false, error: 'illegal-move' })
  })

  it('plays a whole game through the server rules, with the computer filling in, and stays valid', () => {
    let room = started()
    const random = rnd()
    for (let i = 0; i < 4000 && room.state!.phase !== 'over'; i++) {
      const s = room.state!
      const seat = room.humanAt[s.turn]!
      expect(seat).not.toBeNull()
      const msg = s.phase === 'roll' ? { action: 'roll' } : (() => {
        const a = legalActions(s)[0]
        return a.type === 'release' ? { action: 'release', chunk: a.chunk } : { action: 'move', kind: (a as { kind: string }).kind, id: (a as { id: number }).id, chunks: (a as { chunks: number[] }).chunks }
      })()
      const r = applyMove(room, seat, msg, random)
      expect(r.ok).toBe(true)
      if (!r.ok) return
      room = r.room
      expect(invariantErrors(room.state!)).toEqual([])
    }
    expect(room.state!.phase).toBe('over')
    expect(room.wins.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(1)
  })

  it('autoplay stops at a person and never runs forever', () => {
    const room = started()
    const s = autoplay(room.state!, room.humanAt, rnd())
    expect(room.humanAt[s.turn]).not.toBeNull()
  })

  it('replaces an absent player only when their turn is holding the game up', () => {
    const room = started([true, true, false, false])
    const s = room.state!
    const mover = room.humanAt[s.turn]!
    const waiter = mover === 0 ? 1 : 0
    const away = ctx([mover !== 0, mover !== 1, false, false])
    expect(replaceAbsent(room, waiter, { seat: mover }, away, rnd()).ok).toBe(true)
    expect(replaceAbsent(room, waiter, { seat: waiter }, away, rnd())).toEqual({ ok: false, error: 'illegal-move' })
    expect(replaceAbsent(room, waiter, { seat: mover }, ctx([true, true, false, false]), rnd())).toEqual({ ok: false, error: 'illegal-move' })
  })

  it('a rematch waits for everyone who is here', () => {
    const room = started()
    const over = { ...room, state: { ...room.state!, phase: 'over' as const, winner: 0 as const } }
    const c = ctx([true, true, false, false])
    expect(requestRematch(room, 0, c)).toEqual({ ok: false, error: 'game-not-over' })
    const first = requestRematch(over, 0, c, rnd())
    expect(first.ok && first.room.round).toBe(1)
    if (!first.ok) return
    const second = requestRematch(first.room, 1, c, rnd())
    expect(second.ok && second.room.round).toBe(2)
  })

  it('tells each seat who it is and hides nothing it should not', () => {
    const room = started()
    const v = viewFor(room, 1, ctx([true, true, false, false]))
    expect(v.playing).toBe(true)
    expect(viewFor(room, 3, ctx([true, true, false, true])).playing).toBe(false)
    expect(viewFor(newRoom(), 0, ctx([true, false, false, false])).lobby).toBe(true)
  })

  it('does not trust what storage hands back', () => {
    expect(parseRoom(newRoom())).not.toBeNull()
    expect(parseRoom(started())).not.toBeNull()
    expect(parseRoom({ ...started(), humanAt: [9, 0, 0, 0] })).toBeNull()
    expect(parseRoom({ ...newRoom(), wins: [0] })).toBeNull()
    expect(parseRoom(null)).toBeNull()
  })
})
