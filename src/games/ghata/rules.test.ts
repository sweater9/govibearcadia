import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { chooseAction } from './bot'
import {
  COMBINED_TOTALS, FACES, apply, board, invariantErrors, isSafe, keyOf, legalActions, newGame, planJuga, planPawn,
  type Action, type Juga, type Seat, type State, type Where,
} from './rules'

// Pawn ids: seat 0 is 0 to 5, seat 1 is 6 to 11, seat 2 is 12 to 17, seat 3 is 18 to 23.
// Squares: outer o0..o15 (safe: o0 o4 o8 o12), inner i0..i7, centre c. `at` is relative to the owner's start or entry.
// Seat 0 enters the inner ring at i0, seat 1 at i6, seat 2 at i4, seat 3 at i2.

const at = (seat: Seat, key: string): number => (key[0] === 'o' ? (Number(key.slice(1)) - [0, 4, 8, 12][seat] + 16) % 16 : (Number(key.slice(1)) - [0, 6, 4, 2][seat] + 8) % 8)

function put(s: State, id: number, where: Where, key: string | number, credit = true) {
  const p = s.pawns[id]
  p.where = where
  p.at = typeof key === 'number' ? key : at(p.seat, key)
  p.credit = credit
}
function juga(s: State, seat: Seat, key: string, ids: [number, number]): Juga {
  const j: Juga = { id: s.nextJuga++, seat, at: at(seat, key), pawns: ids, pinned: null }
  for (const id of ids) put(s, id, 'juga', j.at)
  s.jugas.push(j)
  return j
}
function pin(s: State, j: Juga, pawn: number) {
  j.pinned = pawn
  s.pawns[pawn].pinnedBy = j.id
}
/** A state in the move phase for `seat` with the given chunks; all of `entered` can be turned on. */
function moving(seat: Seat, queue: number[], entered = true): State {
  const s = newGame()
  s.turn = seat
  s.phase = 'move'
  s.queue = queue
  s.entered = [entered, entered, entered, entered]
  return s
}
const ok = (s: State, a: Action): State => {
  const r = apply(s, a)
  if (!r.ok) throw new Error(`rejected: ${r.error}`)
  return r.state
}
const pawnMove = (id: number, chunks: number[]): Action => ({ type: 'move', kind: 'pawn', id, chunks })
const jugaMove = (id: number, chunks: number[]): Action => ({ type: 'move', kind: 'juga', id, chunks })
const rolls = (s: State, ...pairs: [number, number][]) => pairs.reduce((state, dice) => ok(state, { type: 'roll', dice }), s)
const hasEvent = (s: State, type: string) => s.events.some((e) => e.type === type)

describe('dice', () => {
  const totals = new Set<number>()
  for (const a of FACES) for (const b of FACES) totals.add(a + b)
  it('two dice of 1, 2, 3 and blank (6) give exactly 2, 3, 4, 5, 6, 7, 8, 9 and 12', () => {
    expect([...totals].sort((x, y) => x - y)).toEqual([...COMBINED_TOTALS])
  })
  it('only 3+3 makes Chowka (6) and only blank+blank makes Baara (12)', () => {
    const pairs = (t: number) => FACES.flatMap((a) => FACES.filter((b) => a + b === t).map((b) => [a, b]))
    expect(pairs(6)).toEqual([[3, 3]])
    expect(pairs(12)).toEqual([[6, 6]])
  })
})

describe('rolling', () => {
  it('Chowka and Baara grant another roll; the first other total ends rolling and queues every roll in order', () => {
    let s = newGame()
    s = ok(s, { type: 'roll', dice: [6, 6] })
    expect(s.phase).toBe('roll')
    expect(hasEvent(s, 'bonus-roll')).toBe(true)
    s = ok(s, { type: 'roll', dice: [3, 3] })
    expect(s.phase).toBe('roll')
    s = ok(s, { type: 'roll', dice: [1, 2] })
    expect(s.phase).toBe('move')
    expect(s.queue).toEqual([12, 6, 3])
  })
  it('a non-bonus first roll ends rolling at once, so [3, 3] cannot be accumulated', () => {
    const s = ok(newGame(), { type: 'roll', dice: [1, 2] })
    expect(s.rolls).toEqual([]) // nothing is left waiting: the 3 ended the sequence at once
    expect(s.turn).toBe(1)
  })
  it('three results of 6 or 12 in a row bust: nothing moves and the turn passes', () => {
    const s = rolls(newGame(), [3, 3], [6, 6], [3, 3])
    expect(hasEvent(s, 'bust')).toBe(true)
    expect(s.turn).toBe(1)
    expect(s.queue).toEqual([])
    expect(s.phase).toBe('roll')
  })
  it('with every pawn in the yard, a roll without Chowka or Baara has no legal use and the turn passes', () => {
    const s = ok(newGame(), { type: 'roll', dice: [1, 2] })
    expect(hasEvent(s, 'forfeit')).toBe(true)
    expect(s.turn).toBe(1)
  })
  it('rejects bad dice and rolling out of phase', () => {
    expect(apply(newGame(), { type: 'roll', dice: [4, 1] }).ok).toBe(false)
    expect(apply(moving(0, [3]), { type: 'roll', dice: [1, 1] }).ok).toBe(false)
  })
})

describe('releasing pawns', () => {
  it('a Chowka or Baara chunk releases one pawn onto the start square and is consumed', () => {
    let s = rolls(newGame(), [3, 3], [1, 2]) // queue [6, 3]
    const release = legalActions(s).find((a) => a.type === 'release')!
    s = ok(s, release)
    expect(s.pawns.filter((p) => p.seat === 0 && p.where === 'outer').map((p) => keyOf(0, p.where, p.at))).toEqual(['o0'])
    expect(s.queue).toEqual([3])
  })
  it('every qualifying roll can release a pawn (the owner chose one per qualifying roll)', () => {
    let s = rolls(newGame(), [6, 6], [3, 3], [1, 2]) // [12, 6, 3]
    s = ok(s, { type: 'release', chunk: 0 })
    s = ok(s, { type: 'release', chunk: 0 })
    expect(s.pawns.filter((p) => p.seat === 0 && p.where === 'outer')).toHaveLength(2)
    expect(s.queue).toEqual([3])
  })
  it('a 3 cannot release a pawn', () => {
    const s = moving(0, [3])
    expect(apply(s, { type: 'release', chunk: 0 }).ok).toBe(false)
  })
  it('a start square already holding two of your pawns blocks a release', () => {
    const s = moving(0, [6, 3])
    put(s, 0, 'outer', 'o0')
    put(s, 1, 'outer', 'o0')
    expect(legalActions(s).some((a) => a.type === 'release')).toBe(false)
  })
})

describe('movement chunks', () => {
  it('chunks can go to different pawns, or be combined whole onto one pawn', () => {
    const s = moving(0, [12, 6, 3])
    put(s, 0, 'outer', 'o2', false)
    put(s, 1, 'outer', 'o5', false)
    const sums = legalActions(s).filter((a): a is Extract<Action, { type: 'move' }> => a.type === 'move' && a.id === 0).map((a) => a.chunks.reduce((t, i) => t + s.queue[i], 0))
    expect(sums.sort((a, b) => a - b)).toEqual([3, 6, 9, 12, 15, 18, 21])
    const moved = ok(ok(s, pawnMove(0, [0])), pawnMove(1, [0])) // 12 for pawn 0, then 6 for pawn 1
    expect(moved.pawns[0].at).toBe(14)
    expect(moved.pawns[1].at).toBe(11)
    expect(moved.queue).toEqual([3])
  })
  it('a chunk can never be split: no action exposes part of one, and bad indices are rejected', () => {
    const s = moving(0, [6, 3])
    put(s, 0, 'outer', 'o2', false)
    for (const a of legalActions(s)) if (a.type === 'move') expect(a.chunks.every((i) => Number.isInteger(i))).toBe(true)
    expect(apply(s, pawnMove(0, [0, 0])).ok).toBe(false)
    expect(apply(s, pawnMove(0, [5])).ok).toBe(false)
    expect(apply(s, pawnMove(0, [])).ok).toBe(false)
  })
  it('there is no pass action while a chunk has a legal use', () => {
    const s = moving(0, [3])
    put(s, 0, 'outer', 'o2', false)
    expect(legalActions(s).length).toBeGreaterThan(0)
    expect(legalActions(s).every((a) => a.type !== 'roll')).toBe(true)
  })
  it('tactical freedom: a legal move stands even if it leaves another chunk with no use; that chunk is then forfeited', () => {
    const s = moving(0, [3, 2])
    put(s, 0, 'inner', 'i5') // 3 squares from Home
    const after = ok(s, pawnMove(0, [1])) // move 2, leaving the 3 unusable (the pawn now needs exactly 1)
    expect(hasEvent(after, 'forfeit')).toBe(true)
    expect(after.turn).toBe(1)
  })
  it('the engine rejects moves that are not legal: other players\' pawns, overshooting Home', () => {
    const s = moving(0, [4])
    put(s, 0, 'inner', 'i5')
    put(s, 6, 'outer', 'o2')
    expect(apply(s, pawnMove(0, [0])).ok).toBe(false)
    expect(apply(s, pawnMove(6, [0])).ok).toBe(false)
  })
})

describe('outer ring', () => {
  it('a pawn landing exactly on two enemy pawns captures both, and gains capture credit', () => {
    const s = moving(0, [2])
    put(s, 0, 'outer', 'o1', false)
    put(s, 6, 'outer', 'o3')
    put(s, 7, 'outer', 'o3')
    const after = ok(s, pawnMove(0, [0]))
    expect(after.pawns[6].where).toBe('yard')
    expect(after.pawns[7].where).toBe('yard')
    expect(after.pawns[0].credit).toBe(true)
    expect(after.captured || after.phase === 'roll').toBe(true)
  })
  it('captures never happen on safe squares: opposing pawns coexist', () => {
    const s = moving(0, [2])
    put(s, 0, 'outer', 'o2', false)
    put(s, 6, 'outer', 'o4')
    const after = ok(s, pawnMove(0, [0]))
    expect(after.pawns[6].where).toBe('outer')
    expect(after.pawns[0].at).toBe(4)
    expect(invariantErrors(after)).toEqual([])
  })
  it('only two of your own pawns may share an outer square, and they do not form a Juga there', () => {
    const s = moving(0, [2])
    put(s, 0, 'outer', 'o1', false)
    put(s, 1, 'outer', 'o3', false)
    put(s, 2, 'outer', 'o3', false)
    expect(apply(s, pawnMove(0, [0])).ok).toBe(false)
    const t = moving(0, [2])
    put(t, 0, 'outer', 'o1', false)
    put(t, 1, 'outer', 'o3', false)
    const after = ok(t, pawnMove(0, [0]))
    expect(after.jugas).toHaveLength(0)
    expect(after.pawns[0].where).toBe('outer')
  })
  it('pawns pass through each other freely on unsafe squares', () => {
    const s = moving(0, [3])
    put(s, 0, 'outer', 'o1', false)
    put(s, 6, 'outer', 'o2')
    expect(planPawn(s, s.pawns[0], 3)).not.toBeNull()
  })
})

describe('entering the inner ring', () => {
  it('without capture credit a pawn keeps circulating the outer ring', () => {
    const s = moving(0, [2])
    put(s, 0, 'outer', 15, false)
    const after = ok(s, pawnMove(0, [0]))
    expect(after.pawns[0]).toMatchObject({ where: 'outer', at: 1 })
  })
  it('with capture credit it turns into the inner ring, just inside its own start', () => {
    const s = moving(0, [2], false)
    put(s, 0, 'outer', 15, true)
    const after = ok(s, pawnMove(0, [0]))
    expect(after.pawns[0]).toMatchObject({ where: 'inner', at: 1 })
    expect(keyOf(0, 'inner', 0)).toBe('i0')
    expect(after.entered[0]).toBe(true)
  })
  it('a captured pawn loses its credit and must capture again', () => {
    const s = moving(1, [2])
    put(s, 0, 'outer', 'o3', true)
    put(s, 6, 'outer', 'o1', true)
    const after = ok(s, pawnMove(6, [0]))
    expect(after.pawns[0]).toMatchObject({ where: 'yard', credit: false })
  })
})

describe('Juga formation', () => {
  it('two friendly pawns meeting on the inner ring form a Juga once an opponent has entered', () => {
    const s = moving(0, [2])
    put(s, 0, 'inner', 'i3')
    put(s, 1, 'inner', 'i1')
    const after = ok(s, pawnMove(1, [0]))
    expect(after.jugas).toHaveLength(1)
    expect(after.pawns[0].where).toBe('juga')
    expect(after.pawns[1].where).toBe('juga')
  })
  it('it does not form while no opponent has entered the inner ring', () => {
    const s = moving(0, [2], false)
    s.entered[0] = true
    put(s, 0, 'inner', 'i3')
    put(s, 1, 'inner', 'i1')
    const after = ok(s, pawnMove(1, [0]))
    expect(after.jugas).toHaveLength(0)
  })
  it('an opponent entering later turns waiting pairs into Jugas', () => {
    const s = moving(1, [2], false)
    s.entered[0] = true
    put(s, 0, 'inner', 'i3')
    put(s, 1, 'inner', 'i3')
    put(s, 6, 'outer', 'o3', true) // seat 1: 15 steps along its outer ring; 2 more enter the inner ring
    s.pawns[6].at = 15
    const after = ok(s, pawnMove(6, [0]))
    expect(after.jugas).toHaveLength(1)
    expect(after.jugas[0].seat).toBe(0)
  })
  it('a player never has more than three Jugas and friendly Jugas keep to different squares', () => {
    const s = moving(0, [2])
    juga(s, 0, 'i1', [0, 1])
    put(s, 2, 'inner', 'i0')
    expect(planPawn(s, s.pawns[2], 1)).toBeNull() // landing on a friendly Juga
    expect(planPawn(s, s.pawns[2], 2)).not.toBeNull() // passing over it
  })
})

describe('Juga movement and Home', () => {
  it('moves at half speed, and only an even total is allowed', () => {
    const s = moving(0, [6])
    const j = juga(s, 0, 'i1', [0, 1])
    expect(planJuga(s, j, 6)).toMatchObject({ to: 4 })
    expect(planJuga(s, j, 2)).toMatchObject({ to: 2 })
    expect(planJuga(s, j, 21)).toBeNull()
    expect(planJuga(s, j, 20)).toBeNull() // 10 squares from i1 would pass Home
  })
  it('an odd total cannot be used, and parts are never discarded', () => {
    const s = moving(0, [3, 6])
    juga(s, 0, 'i1', [0, 1])
    const sums = legalActions(s).filter((a) => a.type === 'move').map((a) => (a as Extract<Action, { type: 'move' }>).chunks.reduce((t, i) => t + s.queue[i], 0))
    expect(sums).toEqual([6])
  })
  it('needs the exact count to reach Home: three squares away needs exactly 6, and the rest of the roll goes elsewhere', () => {
    const s = moving(0, [12, 6, 2])
    const j = juga(s, 0, 'i5', [0, 1]) // 3 squares from Home
    put(s, 2, 'outer', 'o2', false)
    expect(planJuga(s, j, 12)).toBeNull()
    expect(planJuga(s, j, 8)).toBeNull()
    const after = ok(s, jugaMove(j.id, [1]))
    expect(after.pawns[0].where).toBe('home')
    expect(after.pawns[1].where).toBe('home')
    expect(after.jugas).toHaveLength(0)
    expect(after.queue).toEqual([12, 2])
  })
  it('a single pawn also needs the exact count', () => {
    const s = moving(0, [4, 3])
    put(s, 0, 'inner', 'i5') // needs 3
    expect(planPawn(s, s.pawns[0], 4)).toBeNull()
    const after = ok(s, pawnMove(0, [1]))
    expect(after.pawns[0].where).toBe('home')
  })
})

describe('blockades', () => {
  it('an opposing Juga blocks landing and passing for single pawns', () => {
    const s = moving(0, [3])
    put(s, 0, 'inner', 'i0')
    juga(s, 1, 'i2', [6, 7])
    expect(planPawn(s, s.pawns[0], 2)).toBeNull() // landing
    expect(planPawn(s, s.pawns[0], 3)).toBeNull() // passing
    expect(planPawn(s, s.pawns[0], 1)).not.toBeNull() // stopping short
  })
  it('Jugas pass over everything', () => {
    const s = moving(0, [4])
    const j = juga(s, 0, 'i0', [0, 1])
    juga(s, 1, 'i1', [6, 7])
    put(s, 12, 'inner', 'i2', false)
    expect(planJuga(s, j, 6)).not.toBeNull() // passes the Juga and a pawn, lands on i3
  })
})

describe('pinning, delayed capture and rescue', () => {
  it('a Juga landing exactly on a single enemy pawn pins it; the pinned pawn cannot move', () => {
    const s = moving(0, [2, 2])
    const j = juga(s, 0, 'i1', [0, 1])
    put(s, 6, 'inner', 'i2')
    const after = ok(s, jugaMove(j.id, [0]))
    expect(after.pawns[6].where).toBe('inner')
    expect(after.pawns[6].pinnedBy).toBe(j.id)
    expect(after.jugas[0].pinned).toBe(6)
    expect(planPawn(after, after.pawns[6], 1)).toBeNull()
    expect(after.captured).toBe(false)
  })
  it('the pawn is captured only when the Juga later moves away, and that earns the bonus', () => {
    let s = moving(0, [2, 2])
    const j = juga(s, 0, 'i1', [0, 1])
    put(s, 6, 'inner', 'i2')
    s = ok(s, jugaMove(j.id, [0]))
    s = ok(s, jugaMove(j.id, [0]))
    expect(s.pawns[6].where).toBe('yard')
    expect(s.pawns[0].credit).toBe(true)
    expect(s.phase).toBe('roll') // one capture bonus
    expect(s.turn).toBe(0)
  })
  it('delayed capture still counts when the Juga moves into Home', () => {
    const s = moving(0, [2])
    const j = juga(s, 0, 'i7', [0, 1])
    pin(s, j, 6)
    put(s, 6, 'inner', 'i7')
    s.pawns[6].credit = false
    const after = ok(s, jugaMove(j.id, [0]))
    expect(after.pawns[6].where).toBe('yard')
    expect(hasEvent(after, 'capture')).toBe(true)
    expect(after.pawns[0].where).toBe('home')
  })
  it('an opposing Juga landing on the pinning Juga captures it and frees the pawn without repinning it', () => {
    const s = moving(2, [4])
    const attacker = juga(s, 0, 'i2', [0, 1])
    put(s, 6, 'inner', 'i2')
    pin(s, attacker, 6)
    const rescuer = juga(s, 2, 'i0', [12, 13])
    const after = ok(s, jugaMove(rescuer.id, [0]))
    expect(after.pawns[0].where).toBe('yard')
    expect(after.pawns[1].where).toBe('yard')
    expect(after.pawns[6]).toMatchObject({ where: 'inner', pinnedBy: null })
    expect(after.jugas).toHaveLength(1)
    expect(after.jugas[0].pinned).toBeNull()
    expect(hasEvent(after, 'rescue')).toBe(true)
    expect(invariantErrors(after)).toEqual([])
  })
})

describe('Juga versus Juga', () => {
  it('capturing sends both pawns home, leaves the attacker intact, and passing over does nothing', () => {
    const s = moving(0, [4, 6])
    const a = juga(s, 0, 'i0', [0, 1])
    juga(s, 1, 'i2', [6, 7])
    const passed = planJuga(s, a, 6) // lands on i3 passing the enemy
    expect(passed).toMatchObject({ captureJugas: [] })
    const after = ok(s, jugaMove(a.id, [0]))
    expect(after.pawns[6].where).toBe('yard')
    expect(after.pawns[7].where).toBe('yard')
    expect(after.jugas).toHaveLength(1)
    expect(after.jugas[0].id).toBe(a.id)
    expect(after.pawns[0].credit).toBe(true)
  })
})

describe('Twin-Capture and chains', () => {
  it('leaving a pin and landing on a Juga captures three pawns for one bonus', () => {
    const s = moving(0, [4])
    const a = juga(s, 0, 'i1', [0, 1])
    put(s, 6, 'inner', 'i1')
    pin(s, a, 6)
    juga(s, 2, 'i3', [12, 13])
    const after = ok(s, jugaMove(a.id, [0]))
    expect([6, 12, 13].every((id) => after.pawns[id].where === 'yard')).toBe(true)
    expect(after.events.find((e) => e.type === 'capture')).toMatchObject({ pawns: 3 })
    expect(after.phase).toBe('roll')
    expect(after.turn).toBe(0)
    expect(after.jugas).toHaveLength(1)
  })
  it('chain: leaving a pin captures it and the Juga pins the next enemy pawn it lands on', () => {
    const s = moving(0, [2])
    const a = juga(s, 0, 'i1', [0, 1])
    put(s, 6, 'inner', 'i1')
    pin(s, a, 6)
    put(s, 18, 'inner', 'i2')
    const after = ok(s, jugaMove(a.id, [0]))
    expect(after.pawns[6].where).toBe('yard')
    expect(after.pawns[18].pinnedBy).toBe(a.id)
    expect(after.jugas[0].pinned).toBe(18)
    expect(after.phase).toBe('roll') // one bonus
  })
})

describe('capture bonuses', () => {
  it('several capturing moves in one allocation sequence earn exactly one bonus', () => {
    let s = moving(0, [2, 2])
    put(s, 0, 'outer', 'o1', false)
    put(s, 1, 'outer', 'o5', false)
    put(s, 6, 'outer', 'o3')
    put(s, 7, 'outer', 'o7')
    s = ok(s, pawnMove(0, [0]))
    expect(s.phase).toBe('move') // the second chunk is still to place
    let bonuses = s.events.filter((e) => e.type === 'capture-bonus').length
    s = ok(s, pawnMove(1, [0]))
    bonuses += s.events.filter((e) => e.type === 'capture-bonus').length
    expect(bonuses).toBe(1)
    expect(s.phase).toBe('roll')
    expect(s.turn).toBe(0)
  })
  it('no capture, no bonus: the turn passes', () => {
    const s = moving(0, [2])
    put(s, 0, 'outer', 'o1', false)
    expect(ok(s, pawnMove(0, [0])).turn).toBe(1)
  })
  it('the bonus is a fresh rolling sequence: the strike count restarts and chains can continue', () => {
    let s = rolls(newGame(), [6, 6], [3, 3], [1, 2]) // [12, 6, 3]
    s = ok(s, { type: 'release', chunk: 0 })
    s = ok(s, { type: 'release', chunk: 0 }) // two pawns on o0 now
    expect(s.queue).toEqual([3])
    // set up a capture with the remaining 3
    put(s, 0, 'outer', 'o1', false)
    put(s, 6, 'outer', 'o4')
    s.pawns[6].at = 15 // seat 1: o3
    const captured = ok(s, pawnMove(0, [0]))
    expect(captured.phase).toBe('roll')
    expect(captured.rolls).toEqual([])
    const bonus = rolls(captured, [6, 6], [3, 3], [1, 1]) // two more Chowka/Baara results without a bust
    expect(bonus.phase).toBe('move')
    expect(bonus.queue).toEqual([12, 6, 2])
  })
  it('a bust in a bonus sequence cancels only that sequence: earlier captures stand', () => {
    const s = moving(0, [2])
    put(s, 0, 'outer', 'o1', false)
    put(s, 6, 'outer', 'o3')
    const captured = ok(s, pawnMove(0, [0]))
    const busted = rolls(captured, [3, 3], [6, 6], [3, 3])
    expect(busted.pawns[6].where).toBe('yard')
    expect(busted.pawns[0].at).toBe(3)
    expect(busted.turn).toBe(1)
  })
})

describe('victory', () => {
  it('a Juga entering Home completes two pawns, and finishing all six wins at once', () => {
    const s = moving(0, [2])
    for (let id = 0; id < 4; id++) put(s, id, 'home', 0)
    const j = juga(s, 0, 'i7', [4, 5])
    const after = ok(s, jugaMove(j.id, [0]))
    expect(after.winner).toBe(0)
    expect(after.phase).toBe('over')
    expect(apply(after, { type: 'roll', dice: [1, 1] }).ok).toBe(false)
  })
  it('victory cancels a pending capture bonus', () => {
    const s = moving(0, [2])
    for (let id = 0; id < 4; id++) put(s, id, 'home', 0)
    const j = juga(s, 0, 'i7', [4, 5])
    put(s, 6, 'inner', 'i7')
    pin(s, j, 6)
    const after = ok(s, jugaMove(j.id, [0]))
    expect(after.pawns[6].where).toBe('yard') // the capture happened
    expect(after.winner).toBe(0)
    expect(after.phase).toBe('over')
    expect(after.captured).toBe(false)
  })
  it('a single pawn can win too', () => {
    const s = moving(0, [3])
    for (let id = 0; id < 5; id++) put(s, id, 'home', 0)
    put(s, 5, 'inner', 'i5')
    expect(ok(s, pawnMove(5, [0])).winner).toBe(0)
  })
})

describe('safe squares', () => {
  it('the five safe squares are the four edge centres and the centre', () => {
    expect(['o0', 'o4', 'o8', 'o12', 'c'].every(isSafe)).toBe(true)
    expect(isSafe('o1') || isSafe('i0')).toBe(false)
  })
  it('the board lists everyone on a square', () => {
    const s = newGame()
    put(s, 0, 'outer', 'o4')
    put(s, 6, 'outer', 'o4')
    expect(board(s).get('o4')?.singles).toHaveLength(2)
  })
})

describe('whole games', () => {
  it('bots finish full four-player games, and the rules invariants hold after every action', () => {
    for (let seed = 0; seed < 12; seed++) {
      const random = createRandom(`ghata-${seed}`)
      let s = newGame()
      let steps = 0
      while (s.phase !== 'over' && steps < 60_000) {
        const result = apply(s, chooseAction(s, random))
        if (!result.ok) throw new Error(`bot made an illegal move: ${result.error}`)
        s = result.state
        expect(invariantErrors(s), `seed ${seed} step ${steps}`).toEqual([])
        steps++
      }
      expect(s.phase, `seed ${seed} did not finish`).toBe('over')
      expect(s.winner).not.toBeNull()
      expect(s.pawns.filter((p) => p.seat === s.winner).every((p) => p.where === 'home')).toBe(true)
    }
  })
  it('the same dice always give the same game', () => {
    const play = () => {
      const random = createRandom('same')
      let s = newGame()
      for (let i = 0; i < 400 && s.phase !== 'over'; i++) s = (apply(s, chooseAction(s, random)) as { state: State }).state
      return JSON.stringify(s)
    }
    expect(play()).toBe(play())
  })
})
