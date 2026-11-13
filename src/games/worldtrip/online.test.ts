import { describe, expect, it } from 'vitest'
import { ONLINE_GAMES } from '../onlineGames'
import { actor } from './bot'
import { applyMove, newRoom, parseRoom, requestRematch, viewFor, winnerOf, type Room } from './online'
import { applyAction, type Action, type State } from './rules'

const act = (room: Room, seat: 0 | 1, action: Action) => applyMove(room, seat, { type: 'move', action })
/** The first seed whose first roll lands on a stop that can be claimed. */
const buySeed = () => {
  for (let i = 0; i < 200; i++) {
    const room = newRoom(`room-${i}`)
    if (applyAction(room.state, { type: 'roll' }).phase === 'buy') return room
  }
  throw new Error('no seed')
}

describe('an online World Trip room', () => {
  it('starts with two travellers and the first seat to move', () => {
    const room = newRoom('seed')
    expect(room.state.players).toHaveLength(2)
    expect(viewFor(room, 0).turn).toBe(0)
    expect(viewFor(room, 1).turn).toBe(0)
  })
  it('only lets the seat whose move it is act, and checks the action', () => {
    const room = newRoom('seed')
    expect(act(room, 1, { type: 'roll' })).toEqual({ ok: false, error: 'not-your-turn' })
    expect(act(room, 0, { type: 'buy' })).toEqual({ ok: false, error: 'illegal-move' }) // legal to send, not legal now
    expect(applyMove(room, 0, { type: 'move', action: { type: 'dance' } })).toEqual({ ok: false, error: 'illegal-move' })
    expect(applyMove(room, 0, { type: 'move' })).toEqual({ ok: false, error: 'illegal-move' })
    const rolled = act(room, 0, { type: 'roll' })
    expect(rolled.ok).toBe(true)
  })
  it('never tells a seat the dice seed', () => {
    const room = newRoom('super-secret-seed')
    for (const seat of [0, 1] as const) {
      expect(JSON.stringify(viewFor(room, seat))).not.toContain('super-secret-seed')
      expect(viewFor(room, seat).board.seed).toBe('')
    }
  })
  it('hands the move to the bidder in an auction and to the buyer of a trade', () => {
    let room = buySeed()
    const rolled = act(room, 0, { type: 'roll' })
    if (!rolled.ok) throw new Error('roll failed')
    room = rolled.room
    const passed = act(room, 0, { type: 'skip' })
    if (!passed.ok) throw new Error('skip failed')
    expect(passed.room.state.phase).toBe('auction')
    expect(actor(passed.room.state)).toBe(1)
    expect(viewFor(passed.room, 1).turn).toBe(1)
    expect(act(passed.room, 0, { type: 'drop' })).toEqual({ ok: false, error: 'not-your-turn' })
    expect(act(passed.room, 1, { type: 'bid', amount: 10 }).ok).toBe(true)
  })
  it('records a finished trip, ranks it and allows a rematch from a fresh seed', () => {
    const done: State = { ...newRoom('x').state, phase: 'done', holdings: newRoom('x').state.holdings.map((h, i) => (i === 1 ? { owner: 0, centre: false } : h)) }
    expect(winnerOf(done)).toBe(0)
    const tie = { ...done, holdings: done.holdings.map(() => null) }
    expect(winnerOf(tie)).toBeNull()
    const room: Room = { state: done, round: 1, wins: [0, 0], rematch: [false, false] }
    const view = viewFor(room, 1)
    expect(view.turn).toBeNull()
    expect(view.winner).toBe(0)
    expect(requestRematch(newRoom('y'), 0)).toEqual({ ok: false, error: 'game-not-over' })
    const first = requestRematch(room, 0)
    if (!first.ok) throw new Error('rematch failed')
    expect(first.room.rematch).toEqual([true, false])
    const second = requestRematch(first.room, 1)
    if (!second.ok) throw new Error('rematch failed')
    expect(second.room.round).toBe(2)
    expect(second.room.state.phase).toBe('roll')
    expect(second.room.state.seed).not.toBe('x')
    expect(applyMove(room, 0, { type: 'move', action: { type: 'end' } })).toEqual({ ok: false, error: 'game-over' })
  })
  it('counts a win for the seat that finishes ahead', () => {
    // Player 2 goes bankrupt on a fee, so player 1 is the last traveller standing.
    const s = newRoom('bankrupt').state
    const poor: State = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, cash: 0 } : p)) }
    let ended: Room | null = null
    for (let i = 0; i < 600 && !ended; i++) {
      const r = applyMove({ state: { ...poor, seed: `b${i}` }, round: 1, wins: [0, 0], rematch: [false, false] }, 0, { type: 'move', action: { type: 'roll' } })
      if (r.ok && r.room.state.phase === 'done') ended = r.room
    }
    expect(ended).not.toBeNull()
    expect(ended!.wins).toEqual([0, 1])
  })
  it('trusts nothing read back from storage', () => {
    const room = newRoom('ok')
    expect(parseRoom(JSON.parse(JSON.stringify(room)))).toEqual(room)
    expect(parseRoom(null)).toBeNull()
    expect(parseRoom({})).toBeNull()
    expect(parseRoom({ ...room, state: { ...room.state, players: [] } })).toBeNull()
    expect(parseRoom({ ...room, state: { ...room.state, phase: 'nope' } })).toBeNull()
    expect(parseRoom({ ...room, state: { ...room.state, holdings: [] } })).toBeNull()
    expect(parseRoom({ ...room, wins: 'x' })).toBeNull()
  })
  it('is registered for the Worker under its game id', () => {
    const g = ONLINE_GAMES['world-trip']
    const room = g.newRoom()
    expect(g.parse(JSON.parse(JSON.stringify(room)))).not.toBeNull()
    expect(g.move(room, 0, { type: 'move', action: { type: 'roll' } })).toMatchObject({ ok: true })
    expect(g.move(room, 1, { type: 'move', action: { type: 'roll' } })).toEqual({ ok: false, error: 'not-your-turn' })
  })
})
