import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { FLEET_LENGTHS, SIZE, act, aiShot, isFleet, newRoom, parseRoom, randomFleet, scoreFor, viewFor, type Fleet, type Room, type Seat } from './rules'

const ok = (r: ReturnType<typeof act>): Room => {
  if (!r.ok) throw new Error(r.error)
  return r.room
}
const startBattle = (room: Room): Room => ok(act(ok(act(room, 0, { type: 'ready' })), 1, { type: 'ready' }))

/** A fixed fleet: horizontal ships down the left edge, one per row, so tests know where everything is. */
const lineup = (offset = 0): Fleet => FLEET_LENGTHS.map((len, k) => Array.from({ length: len }, (_, c) => (k * 2 + offset) * SIZE + c))

describe('fleets', () => {
  it('random fleets are valid, and the same seed gives the same fleet', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const f = randomFleet(createRandom(seed))
      expect(isFleet(f)).toBe(true)
      expect(f.flat()).toHaveLength(17)
      expect(new Set(f.flat()).size).toBe(17)
      expect(randomFleet(createRandom(seed))).toEqual(f)
    }
  })
  it('rejects overlapping, bent, wrong-length and out-of-range fleets', () => {
    expect(isFleet(lineup())).toBe(true)
    expect(isFleet([...lineup().slice(0, 4)])).toBe(false)
    const overlap = lineup()
    overlap[1] = [0, 1, 2, 3]
    expect(isFleet(overlap)).toBe(false)
    const bent = lineup()
    bent[0] = [0, 1, 2, 3, 14]
    expect(isFleet(bent)).toBe(false)
    const wide = lineup()
    wide[4] = [9, 10]
    expect(isFleet(wide)).toBe(false)
    const out = lineup()
    out[4] = [98, 99]
    expect(isFleet(out)).toBe(true)
    out[4] = [99, 100]
    expect(isFleet(out)).toBe(false)
    expect(isFleet('x')).toBe(false)
  })
})

describe('a round', () => {
  it('needs both players ready, then the starter shoots; shuffling stops once ready', () => {
    let room = newRoom(createRandom('r'))
    expect(act(room, 0, { type: 'move', cell: 5 })).toEqual({ ok: false, error: 'wrong-phase' })
    room = ok(act(room, 0, { type: 'shuffle' }, createRandom('s')))
    expect(room.fleets[0]).not.toEqual(newRoom(createRandom('r')).fleets[0])
    room = ok(act(room, 0, { type: 'ready' }))
    expect(room.phase).toBe('placing')
    expect(act(room, 0, { type: 'shuffle' })).toEqual({ ok: false, error: 'wrong-phase' })
    room = ok(act(room, 1, { type: 'ready' }))
    expect(room.phase).toBe('battle')
    expect(room.turn).toBe(0)
  })
  it('enforces turns, bounds and no repeat shots, and alternates after every shot', () => {
    let room = startBattle(newRoom(createRandom('r')))
    expect(act(room, 1, { type: 'move', cell: 0 })).toEqual({ ok: false, error: 'not-your-turn' })
    expect(act(room, 0, { type: 'move', cell: 100 })).toEqual({ ok: false, error: 'illegal-move' })
    expect(act(room, 0, { type: 'move', cell: -1 })).toEqual({ ok: false, error: 'illegal-move' })
    expect(act(room, 0, { type: 'move', cell: '5' })).toEqual({ ok: false, error: 'illegal-move' })
    expect(act(room, 0, { type: 'nonsense' })).toEqual({ ok: false, error: 'illegal-move' })
    room = ok(act(room, 0, { type: 'move', cell: 5 }))
    expect(room.turn).toBe(1)
    room = ok(act(room, 1, { type: 'move', cell: 5 }))
    expect(act(room, 0, { type: 'move', cell: 5 })).toEqual({ ok: false, error: 'illegal-move' })
  })
  it('reports hit, sunk and miss from the shooter’s view, and ends when the last ship sinks', () => {
    let room = startBattle({ ...newRoom(createRandom('r')), fleets: [lineup(), lineup()] })
    const first = room.fleets[1][4] // the destroyer: 2 cells
    room = ok(act(room, 0, { type: 'move', cell: first[0] }))
    expect(viewFor(room, 0).board.shots).toEqual([{ cell: first[0], result: 'hit' }])
    room = ok(act(room, 1, { type: 'move', cell: 99 })) // a miss
    room = ok(act(room, 0, { type: 'move', cell: first[1] }))
    expect(viewFor(room, 0).board.shots.at(-1)).toEqual({ cell: first[1], result: 'sunk' })
    expect(viewFor(room, 0).board.sunk).toEqual([first])
    expect(viewFor(room, 0).board.left).toEqual({ you: 5, opp: 4 })
    // Sink everything else.
    for (const cell of room.fleets[1].slice(0, 4).flat()) {
      room = ok(act(room, 1, { type: 'move', cell: 98 - room.received[0].length }))
      room = ok(act(room, 0, { type: 'move', cell }))
    }
    expect(room.phase).toBe('over')
    expect(room.winner).toBe(0)
    expect(room.wins).toEqual([1, 0])
    expect(viewFor(room, 0).turn).toBeNull()
    expect(act(room, 1, { type: 'move', cell: 1 })).toEqual({ ok: false, error: 'game-over' })
  })
  it('a rematch needs both players, swaps who shoots first, reshuffles and keeps the tally', () => {
    let room: Room = { ...startBattle({ ...newRoom(createRandom('r')), fleets: [lineup(), lineup()] }) }
    room = { ...room, phase: 'over', winner: 0, wins: [1, 0] }
    expect(act(startBattle(newRoom()), 0, { type: 'rematch' })).toEqual({ ok: false, error: 'game-not-over' })
    room = ok(act(room, 0, { type: 'rematch' }))
    expect(room.phase).toBe('over')
    room = ok(act(room, 1, { type: 'rematch' }, createRandom('again')))
    expect(room).toMatchObject({ phase: 'placing', round: 2, starter: 1, wins: [1, 0], rematch: [false, false], received: [[], []] })
    expect(viewFor(room, 1)).toMatchObject({ yourColour: 1, turn: 1 })
  })
})

describe('hidden information', () => {
  /** Two rooms identical except that seat 1’s ships are somewhere else entirely. */
  const pair = (): [Room, Room] => {
    const base = newRoom(createRandom('hide'))
    const a: Room = { ...base, fleets: [lineup(0), lineup(0)] }
    const b: Room = { ...base, fleets: [lineup(0), randomFleet(createRandom('elsewhere'))] }
    return [a, b]
  }
  it('seat 0 sees exactly the same thing whatever seat 1’s unrevealed ships are', () => {
    const [a, b] = pair()
    expect(viewFor(a, 0)).toEqual(viewFor(b, 0))
    // Placing: shuffles by seat 1 change nothing seat 0 can see.
    const shuffled = ok(act(b, 1, { type: 'shuffle' }, createRandom('x')))
    expect(viewFor(shuffled, 0)).toEqual(viewFor(a, 0))
    // Battle: a shot that misses both layouts looks identical in both.
    const cell = [...Array(100).keys()].find((i) => !a.fleets[1].flat().includes(i) && !b.fleets[1].flat().includes(i))!
    const play = (r: Room) => ok(act(startBattle(r), 0, { type: 'move', cell }))
    expect(viewFor(play(a), 0)).toEqual(viewFor(play(b), 0))
    expect(JSON.stringify(viewFor(play(b), 0))).not.toContain(JSON.stringify(b.fleets[1][0]))
  })
  it('shows an unsunk ship only as hit cells, and reveals the fleet only when the round is over', () => {
    const [a] = pair()
    let room = startBattle(a)
    room = ok(act(room, 0, { type: 'move', cell: a.fleets[1][0][0] })) // hit one cell of the 5-ship
    const v = viewFor(room, 0)
    expect(v.board.sunk).toEqual([])
    expect(v.board.reveal).toBeNull()
    expect(v.board.shots).toEqual([{ cell: a.fleets[1][0][0], result: 'hit' }])
    const done = { ...room, phase: 'over' as const, winner: 1 as Seat }
    expect(viewFor(done, 0).board.reveal).toEqual(a.fleets[1])
  })
  it('the view never names the opponent’s unsunk ships anywhere, in a whole played game', () => {
    const random = createRandom('whole')
    let room = startBattle(newRoom(random))
    for (let i = 0; i < 300 && room.phase === 'battle'; i++) {
      const seat = room.turn
      room = ok(act(room, seat, { type: 'move', cell: aiShot(viewFor(room, seat), random) }))
      for (const s of [0, 1] as const) {
        const view = viewFor(room, s)
        const known = new Set<number>([...view.board.shots.map((x) => x.cell), ...view.board.sunk.flat(), ...(view.board.reveal?.flat() ?? [])])
        const oppShips = room.fleets[s === 0 ? 1 : 0].flat()
        // Every opponent ship cell the view mentions in a ship list must be a cell I shot or a sunk ship.
        for (const ship of view.board.sunk) for (const c of ship) expect(oppShips).toContain(c)
        for (const ship of room.fleets[s === 0 ? 1 : 0]) {
          const revealedWhole = ship.every((c) => known.has(c))
          const listed = view.board.sunk.some((x) => x.join() === ship.join())
          if (room.phase !== 'over') expect(listed).toBe(revealedWhole)
        }
      }
    }
    expect(room.phase).toBe('over')
  })
})

describe('storage and the computer', () => {
  it('survives a storage round trip and refuses broken data', () => {
    const room = startBattle(newRoom(createRandom('p')))
    expect(parseRoom(JSON.parse(JSON.stringify(room)))).toEqual(room)
    expect(parseRoom(null)).toBeNull()
    expect(parseRoom({ ...room, phase: 'dancing' })).toBeNull()
    expect(parseRoom({ ...room, fleets: [[], []] })).toBeNull()
    expect(parseRoom({ ...room, received: [[1000], []] })).toBeNull()
  })
  it('the computer only fires at fresh cells, finishes whole games, and beats a no-skill shooter on average', () => {
    let total = 0
    for (const seed of ['a', 'b', 'c', 'd']) {
      const random = createRandom(seed)
      let room = startBattle(newRoom(random))
      let shots = 0
      while (room.phase === 'battle') {
        const seat = room.turn
        const cell = aiShot(viewFor(room, seat), random)
        expect(room.received[seat === 0 ? 1 : 0]).not.toContain(cell)
        room = ok(act(room, seat, { type: 'move', cell }))
        if (seat === 1) shots++
      }
      total += shots
    }
    expect(total / 4).toBeLessThan(80) // a blind shooter averages about 95
  })
  it('is deterministic for a seed', () => {
    const play = () => {
      const random = createRandom('det')
      let room = startBattle(newRoom(random))
      while (room.phase === 'battle') room = ok(act(room, room.turn, { type: 'move', cell: aiShot(viewFor(room, room.turn), random) }))
      return room.received
    }
    expect(play()).toEqual(play())
  })
  it('scores', () => {
    expect(scoreFor(true, 40)).toBe(760)
    expect(scoreFor(true, 100)).toBe(400)
    expect(scoreFor(false, 30)).toBe(0)
  })
})
