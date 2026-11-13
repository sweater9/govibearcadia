import { describe, expect, it } from 'vitest'
import { ONLINE_GAMES } from '../onlineGames'
import { actor } from './bot'
import { applyMove, hostOf, isOpen, newRoom, parseRoom, removeAbsent, requestRematch, SEATS, startTrip, viewFor, winnerOf, type Context, type Room } from './online'
import { applyAction, type Action, type State } from './rules'

const here = (n: number, gone: number[] = []): Context => ({
  seated: Array.from({ length: SEATS }, (_, i) => i < n),
  connected: Array.from({ length: SEATS }, (_, i) => i < n && !gone.includes(i)),
})
const begin = (n: number, seed: string): Room => {
  const r = startTrip(newRoom(), 0, here(n), seed)
  if (!r.ok) throw new Error(`could not start: ${r.error}`)
  return r.room
}
const act = (room: Room, seat: number, action: Action) => applyMove(room, seat, { type: 'move', action })
/** The first seed whose first roll lands on a stop that can be claimed. */
const buySeed = (n = 2) => {
  for (let i = 0; i < 200; i++) {
    const room = begin(n, `room-${i}`)
    if (applyAction(room.state!, { type: 'roll' }).phase === 'buy') return room
  }
  throw new Error('no seed')
}

describe('the lobby', () => {
  it('starts empty and open, and only shows a lobby view', () => {
    const room = newRoom()
    expect(room.state).toBeNull()
    expect(isOpen(room)).toBe(true)
    expect(viewFor(room, 0, here(3))).toMatchObject({ lobby: true, turn: null, board: null, seated: 3, host: 0 })
  })
  it('lets only the host start, and only with two travellers here', () => {
    expect(startTrip(newRoom(), 1, here(3))).toEqual({ ok: false, error: 'not-host' })
    expect(startTrip(newRoom(), 0, here(1))).toEqual({ ok: false, error: 'need-two' })
    expect(applyMove(newRoom(), 0, { type: 'move', action: { type: 'roll' } })).toEqual({ ok: false, error: 'not-started' })
  })
  it('hands hosting to the next traveller when the first has gone', () => {
    expect(hostOf([false, true, true])).toBe(1)
    const r = startTrip(newRoom(), 1, here(3, [0]), 'x')
    expect(r.ok).toBe(true)
  })
  it.each([2, 3, 4, 5, 6])('deals a trip to %i travellers and closes the room', (n) => {
    const room = begin(n, 'seed')
    expect(room.state!.players).toHaveLength(n)
    expect(isOpen(room)).toBe(false)
    expect(startTrip(room, 0, here(n))).toEqual({ ok: false, error: 'illegal-move' })
    for (let seat = 0; seat < n; seat++) expect(viewFor(room, seat, here(n)).turn).toBe(0)
  })
  it('puts a traveller who was not here at the start out of the trip', () => {
    const r = startTrip(newRoom(), 0, here(3, [1]), 'seed')
    if (!r.ok) throw new Error('start failed')
    expect(r.room.state!.players.map((p) => p.out)).toEqual([false, true, false])
  })
})

describe('an online World Trip room', () => {
  it('only lets the seat whose move it is act, and checks the action', () => {
    const room = begin(3, 'seed')
    expect(act(room, 1, { type: 'roll' })).toEqual({ ok: false, error: 'not-your-turn' })
    expect(act(room, 2, { type: 'roll' })).toEqual({ ok: false, error: 'not-your-turn' })
    expect(act(room, 0, { type: 'buy' })).toEqual({ ok: false, error: 'illegal-move' })
    expect(applyMove(room, 0, { type: 'move', action: { type: 'dance' } })).toEqual({ ok: false, error: 'illegal-move' })
    expect(applyMove(room, 0, { type: 'move' })).toEqual({ ok: false, error: 'illegal-move' })
    expect(act(room, 0, { type: 'roll' }).ok).toBe(true)
  })
  it('never tells a seat the dice seed', () => {
    const room = begin(4, 'super-secret-seed')
    for (let seat = 0; seat < 4; seat++) {
      expect(JSON.stringify(viewFor(room, seat, here(4)))).not.toContain('super-secret-seed')
      expect(viewFor(room, seat, here(4)).board!.seed).toBe('')
    }
  })
  it('hands the move to the bidder in an auction, round the table', () => {
    const rolled = act(buySeed(4), 0, { type: 'roll' })
    if (!rolled.ok) throw new Error('roll failed')
    const passed = act(rolled.room, 0, { type: 'skip' })
    if (!passed.ok) throw new Error('skip failed')
    expect(passed.room.state!.phase).toBe('auction')
    expect(actor(passed.room.state!)).toBe(1)
    expect(act(passed.room, 0, { type: 'drop' })).toEqual({ ok: false, error: 'not-your-turn' })
    const bid = act(passed.room, 1, { type: 'bid', amount: 10 })
    if (!bid.ok) throw new Error('bid failed')
    expect(actor(bid.room.state!)).toBe(2)
  })
})

describe('a traveller who has gone', () => {
  const remove = (room: Room, seat: number, target: number, ctx: Context) => removeAbsent(room, seat, { type: 'remove', seat: target }, ctx)
  it('can be removed once their move is holding everyone up', () => {
    const room = begin(3, 'seed')
    const rolled = act(room, 0, { type: 'roll' })
    if (!rolled.ok) throw new Error('roll failed')
    const ended = act(rolled.room, 0, { type: 'end' })
    const next = ended.ok ? ended.room : rolled.room
    const waiting = actor(next.state!)
    const ctx = here(3, [waiting])
    const other = [0, 1, 2].find((i) => i !== waiting)!
    const done = remove(next, other, waiting, ctx)
    if (!done.ok) throw new Error(`remove failed: ${done.error}`)
    expect(done.room.state!.players[waiting].out).toBe(true)
    expect(actor(done.room.state!)).not.toBe(waiting)
  })
  it('cannot be removed while connected, out of turn, or by themselves', () => {
    const room = begin(3, 'seed')
    expect(remove(room, 1, 0, here(3))).toEqual({ ok: false, error: 'illegal-move' }) // still here
    expect(remove(room, 0, 1, here(3, [1]))).toEqual({ ok: false, error: 'illegal-move' }) // not their move
    expect(remove(room, 0, 0, here(3, [0]))).toEqual({ ok: false, error: 'illegal-move' }) // yourself
    expect(removeAbsent(room, 1, { type: 'remove', seat: 'x' }, here(3, [0]))).toEqual({ ok: false, error: 'illegal-move' })
    expect(removeAbsent(room, 1, { type: 'remove', seat: 9 }, here(3, [0]))).toEqual({ ok: false, error: 'illegal-move' })
    expect(remove(newRoom(), 1, 0, here(3, [0]))).toEqual({ ok: false, error: 'not-started' })
  })
  it('ends the trip when only one traveller is left, and that traveller wins', () => {
    const room = begin(2, 'seed')
    const r = remove(room, 1, 0, here(2, [0]))
    if (!r.ok) throw new Error('remove failed')
    expect(r.room.state!.phase).toBe('done')
    expect(winnerOf(r.room.state!)).toBe(1)
    expect(r.room.wins[1]).toBe(1)
  })
  it('works for the bidder in an auction', () => {
    const rolled = act(buySeed(3), 0, { type: 'roll' })
    if (!rolled.ok) throw new Error('roll failed')
    const passed = act(rolled.room, 0, { type: 'skip' })
    if (!passed.ok) throw new Error('skip failed')
    const bidder = actor(passed.room.state!)
    const r = remove(passed.room, 0, bidder, here(3, [bidder]))
    if (!r.ok) throw new Error(`remove failed: ${r.error}`)
    expect(r.room.state!.players[bidder].out).toBe(true)
    expect(actor(r.room.state!)).not.toBe(bidder)
  })
})

describe('the end of a trip', () => {
  it('ranks a finished trip among those still in, and lets those who are here play again from a fresh seed', () => {
    const base = begin(3, 'x').state!
    const done: State = { ...base, phase: 'done', holdings: base.holdings.map((h, i) => (i === 1 ? { owner: 2, centre: false } : h)) }
    expect(winnerOf(done)).toBe(2)
    expect(winnerOf({ ...done, holdings: done.holdings.map(() => null) })).toBeNull()
    expect(winnerOf({ ...done, players: done.players.map((p, i) => (i === 2 ? { ...p, out: true } : p)) })).not.toBe(2)
    const room: Room = { state: done, round: 1, wins: [0, 0, 1, 0, 0, 0], rematch: [false, false, false, false, false, false] }
    const view = viewFor(room, 1, here(3))
    expect(view.turn).toBeNull()
    expect(view.winner).toBe(2)
    expect(requestRematch(begin(2, 'y'), 0, here(2))).toEqual({ ok: false, error: 'game-not-over' })
    let r = requestRematch(room, 0, here(3))
    if (!r.ok) throw new Error('rematch failed')
    r = requestRematch(r.room, 1, here(3))
    if (!r.ok) throw new Error('rematch failed')
    expect(r.room.rematch).toEqual([true, true, false, false, false, false])
    r = requestRematch(r.room, 2, here(3))
    if (!r.ok) throw new Error('rematch failed')
    expect(r.room.round).toBe(2)
    expect(r.room.state!.phase).toBe('roll')
    expect(r.room.state!.seed).not.toBe('x')
    expect(r.room.wins[2]).toBe(1)
    expect(applyMove(room, 0, { type: 'move', action: { type: 'end' } })).toEqual({ ok: false, error: 'game-over' })
  })
  it('does not wait for a traveller who has gone when asking for a rematch', () => {
    const base = begin(3, 'x').state!
    const room: Room = { state: { ...base, phase: 'done' }, round: 1, wins: Array(6).fill(0), rematch: Array(6).fill(false) }
    const ctx = here(3, [2])
    let r = requestRematch(room, 0, ctx)
    if (!r.ok) throw new Error('rematch failed')
    r = requestRematch(r.room, 1, ctx)
    if (!r.ok) throw new Error('rematch failed')
    expect(r.room.round).toBe(2)
    expect(r.room.state!.players.map((p) => p.out)).toEqual([false, false, true])
  })
  it('counts a win for the seat that finishes ahead', () => {
    // Player 1 has no cash, so the first fee they cannot pay sends them out and player 2 is the last traveller standing.
    const s = begin(2, 'bankrupt').state!
    const poor: State = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, cash: 0 } : p)) }
    let ended: Room | null = null
    for (let i = 0; i < 600 && !ended; i++) {
      const r = applyMove({ state: { ...poor, seed: `b${i}` }, round: 1, wins: Array(6).fill(0), rematch: Array(6).fill(false) }, 0, { type: 'move', action: { type: 'roll' } })
      if (r.ok && r.room.state!.phase === 'done') ended = r.room
    }
    expect(ended).not.toBeNull()
    expect(ended!.wins.slice(0, 2)).toEqual([0, 1])
  })
})

describe('storage and registration', () => {
  it('trusts nothing read back from storage', () => {
    const lobby = newRoom()
    expect(parseRoom(JSON.parse(JSON.stringify(lobby)))).toEqual(lobby)
    const room = begin(3, 'ok')
    expect(parseRoom(JSON.parse(JSON.stringify(room)))).toEqual(room)
    expect(parseRoom(null)).toBeNull()
    expect(parseRoom({})).toBeNull()
    expect(parseRoom({ ...room, state: { ...room.state, players: [] } })).toBeNull()
    expect(parseRoom({ ...room, state: { ...room.state, players: Array(7).fill(room.state!.players[0]) } })).toBeNull()
    expect(parseRoom({ ...room, state: { ...room.state, phase: 'nope' } })).toBeNull()
    expect(parseRoom({ ...room, state: { ...room.state, holdings: [] } })).toBeNull()
    expect(parseRoom({ ...room, wins: 'x' })).toBeNull()
    expect(parseRoom({ ...room, wins: [0, 0] })).toBeNull()
  })
  it('is registered for the Worker with six seats and a lobby', () => {
    const g = ONLINE_GAMES['world-trip']
    expect(g.seats).toBe(6)
    const room = g.newRoom()
    expect(g.open?.(room)).toBe(true)
    expect(g.parse(JSON.parse(JSON.stringify(room)))).not.toBeNull()
    expect(g.move(room, 0, { type: 'move', action: { type: 'roll' } })).toEqual({ ok: false, error: 'not-started' })
    const started = g.act!(room, 0, { type: 'start' }, here(3))
    expect(started).toMatchObject({ ok: true })
    if (started.ok) expect(g.open?.(started.room)).toBe(false)
    expect(g.act!(room, 1, { type: 'start' }, here(3))).toEqual({ ok: false, error: 'not-host' })
  })
})
