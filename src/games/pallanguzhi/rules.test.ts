import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { LEVELS, choosePit } from './ai'
import {
  DEFAULT_CONFIG, apply, fillable, invariantErrors, legalPits, newGame, opposite, ownerOf, replay, routeNext, seedsOnBoard,
  type Action, type State,
} from './rules'

/** A board with exactly these seeds, the rest of the 70 sitting in the stores so seeds are still conserved. */
function position(pits: Record<number, number>, over: Partial<State> = {}): State {
  const s = newGame()
  s.pits = Array(14).fill(0)
  for (const [i, n] of Object.entries(pits)) s.pits[Number(i)] = n
  s.stores = [0, 0]
  s.stores[0] = 70 - seedsOnBoard(s)
  return Object.assign(s, over)
}
const sow = (s: State, pit: number) => {
  const r = apply(s, { type: 'sow', pit })
  if (!r.ok) throw new Error(r.reason)
  return r
}

/** Both sowings of a capturing turn: the first from `a`, the earned second from `b`. */
const twice = (s: State, a: number, b: number) => sow(sow(s, a).state, b)

describe('board', () => {
  it('starts with 14 pits, five seeds in each, 70 in total, and empty stores', () => {
    const s = newGame()
    expect(s.pits).toHaveLength(14)
    expect(s.pits.every((n) => n === 5)).toBe(true)
    expect(seedsOnBoard(s)).toBe(70)
    expect(s.stores).toEqual([0, 0])
    expect(invariantErrors(s)).toEqual([])
  })
  it('Player 1 owns the bottom row (0 to 6) and Player 2 the top row (7 to 13); opposite pits face each other', () => {
    expect([0, 6, 7, 13].map(ownerOf)).toEqual([0, 0, 1, 1])
    expect([0, 6, 7, 13].map(opposite)).toEqual([13, 7, 6, 0])
    expect(Array.from({ length: 14 }, (_, i) => opposite(opposite(i)))).toEqual(Array.from({ length: 14 }, (_, i) => i))
  })
  it('sowing runs 0 to 13 and wraps: counterclockwise, always the same way round', () => {
    const s = newGame()
    expect(routeNext(s, 6)).toBe(7)
    expect(routeNext(s, 13)).toBe(0)
  })
})

describe('choosing a pit', () => {
  it('only your own, active, non-empty pits are legal', () => {
    const s = position({ 1: 2, 3: 1, 8: 4 })
    expect(legalPits(s)).toEqual([1, 3])
    expect(apply(s, { type: 'sow', pit: 8 })).toEqual({ ok: false, reason: 'not-your-pit' })
    expect(apply(s, { type: 'sow', pit: 2 })).toEqual({ ok: false, reason: 'empty-pit' })
    expect(apply(s, { type: 'sow', pit: 20 })).toEqual({ ok: false, reason: 'no-such-pit' })
    s.active[3] = false
    s.pits[3] = 0
    expect(apply(s, { type: 'sow', pit: 3 })).toEqual({ ok: false, reason: 'inactive-pit' })
  })
  it('an illegal action changes nothing', () => {
    const s = newGame()
    const before = JSON.stringify(s)
    apply(s, { type: 'sow', pit: 9 })
    expect(JSON.stringify(s)).toBe(before)
  })
})

describe('sowing', () => {
  it('drops one seed per pit counterclockwise, through both rows, and keeps the lifted pit empty', () => {
    // 3 seeds from pit 5 land in 6, 7, 8; pit 9 is empty, so it is a Saada (nothing beyond to take).
    const s = position({ 5: 3, 10: 1, 0: 1 })
    const r = sow(s, 5)
    expect(r.state.pits[5]).toBe(0)
    expect(r.state.pits.slice(6, 9)).toEqual([1, 1, 1])
    expect(r.trace.filter((t) => t.t === 'drop').map((t) => (t.t === 'drop' ? t.pit : -1))).toEqual([6, 7, 8])
  })
  it('relay: the pit after the last seed is lifted and sowing goes on, over several laps', () => {
    const s = position({ 0: 3, 3: 2, 5: 1 })
    // 0 -> drops 1,2,3 (pit 3 becomes 3); next pit 4 empty -> Saada. No relay here...
    const flat = sow(s, 0)
    expect(flat.trace.some((t) => t.t === 'pick' && t.relay)).toBe(false)
    // ...but with seeds in pit 4 the lift continues: 3 from pit 4 land in 5, 6, 7.
    const relay = sow(position({ 0: 3, 4: 3 }), 0)
    const picks = relay.trace.filter((t) => t.t === 'pick')
    expect(picks.map((t) => (t.t === 'pick' ? [t.pit, t.seeds, t.relay] : []))).toEqual([[0, 3, false], [4, 3, true]])
  })
  it('a fresh board relays on through many pits and still conserves every seed', () => {
    const r = sow(newGame(), 2)
    expect(r.trace.filter((t) => t.t === 'pick').length).toBeGreaterThan(2)
    expect(invariantErrors(r.state)).toEqual([])
  })
  it('a pit with more than 13 seeds goes round more than one lap', () => {
    const s = position({ 2: 16, 9: 1 })
    const r = sow(s, 2)
    expect(r.trace.filter((t) => t.t === 'drop').length).toBeGreaterThanOrEqual(16)
    expect(invariantErrors(r.state)).toEqual([])
  })
})

describe('Saada capture', () => {
  it('the next pit is empty: skip it, take the pit beyond it and the pit opposite that one', () => {
    // 2 seeds from pit 0 land in 1 and 2; pit 3 is empty; pit 4 (3 seeds) and its opposite pit 9 (4 seeds) are captured.
    const s = position({ 0: 2, 1: 1, 2: 1, 4: 3, 6: 2, 8: 3, 9: 4, 12: 1, 13: 2 })
    const r = sow(s, 0)
    expect(r.state.stores[0] - s.stores[0]).toBe(7)
    expect(r.state.pits[4]).toBe(0)
    expect(r.state.pits[9]).toBe(0)
    expect(r.state.pits[3]).toBe(0)
    expect(r.state.lastEmpty).toBe(3)
    expect(r.trace.at(-1)).toEqual({ t: 'saada', empty: 3, captured: [{ pit: 4, seeds: 3 }, { pit: 9, seeds: 4 }] })
    expect(invariantErrors(r.state)).toEqual([])
  })
  it('an empty capture pit adds zero; the other still counts', () => {
    const s = position({ 0: 2, 9: 4, 13: 1 }) // beyond the empty pit 3 is pit 4 (empty); its opposite, pit 9, holds 4
    const r = sow(s, 0)
    expect(r.state.stores[0] - s.stores[0]).toBe(4)
    expect(r.state.pits[9]).toBe(0)
  })
  it('captured seeds are added to the mover, never lost or created', () => {
    const s = position({ 0: 2, 4: 3, 9: 4, 13: 1 })
    const r = sow(s, 0)
    expect(seedsOnBoard(r.state) + r.state.stores[0] + r.state.stores[1]).toBe(70)
  })
  it('Player 2 captures the same way, into their own store', () => {
    const s = position({ 7: 2, 11: 3, 2: 4, 0: 1 }, { turn: 1 })
    // 2 seeds from pit 7: land in 8, 9; pit 10 empty; beyond is 11 (3), opposite of 11 is 2 (4).
    const r = sow(s, 7)
    expect(r.state.stores[1]).toBe(7)
  })
  it('skips an inactive pit when looking for the empty pit and the pit beyond it', () => {
    const s = position({ 0: 2, 1: 1, 4: 3, 9: 4, 13: 1 })
    s.active[3] = false // the route goes 2 -> 4 directly
    const r = sow(s, 0) // drops 1, 2; next route pit is 4 (3 seeds) so it relays
    expect(r.trace.some((t) => t.t === 'pick' && t.pit === 4 && t.relay)).toBe(true)
  })
})

describe('second sowing', () => {
  const capturing = () => position({ 0: 2, 1: 1, 2: 1, 4: 3, 6: 2, 8: 3, 9: 4, 12: 1, 13: 2 })
  it('a capture earns a second sowing by the same player, from any of their non-empty pits', () => {
    const r = sow(capturing(), 0)
    expect(r.state.turn).toBe(0)
    expect(r.state.sowings).toBe(1)
    expect(legalPits(r.state)).toEqual([1, 2, 6])
    expect(r.state.events.some((e) => e.type === 'second-sowing')).toBe(true)
  })
  it('the turn ends after the second sowing, whether or not it captures, and never gives a third', () => {
    const first = sow(capturing(), 0).state
    const second = sow(first, 2).state // 2 seeds -> 3, 4; pit 5 empty; beyond 6 (2) + opposite 7 (0) = a second capture
    expect(second.stores[0]).toBeGreaterThan(first.stores[0])
    expect(second.turn).toBe(1)
    expect(second.sowings).toBe(0)
  })
  it('a first sowing without a capture ends the turn', () => {
    const r = sow(position({ 0: 2, 12: 1, 13: 1 }), 0) // lands 1, 2; pit 3 empty; beyond (4) and opposite (9) are empty
    expect(r.state.turn).toBe(1)
    expect(r.state.stores[0]).toBe(70 - 4)
  })
  it('two empty capture pits do not earn a second sowing by default, but can by configuration', () => {
    const base = position({ 0: 2, 12: 1, 13: 1 })
    expect(sow(base, 0).state.turn).toBe(1)
    const variant = position({ 0: 2, 12: 1, 13: 1 }, { config: { ...DEFAULT_CONFIG, zeroCaptureGrantsSecond: true } })
    expect(sow(variant, 0).state.turn).toBe(0)
  })
  it('the sowing limit comes from the configuration', () => {
    const s = sow(position({ 0: 2, 1: 1, 2: 1, 4: 3, 6: 2, 8: 3, 9: 4, 12: 1, 13: 2 }, { config: { ...DEFAULT_CONFIG, maxSowings: 1 } }), 0).state
    expect(s.turn).toBe(1)
  })
  it('a sowing cannot be forced once the limit is used', () => {
    const s = position({ 0: 1, 1: 1 }, { sowings: 2 })
    expect(apply(s, { type: 'sow', pit: 0 })).toEqual({ ok: false, reason: 'no-sowings-left' })
  })
})

describe('turns and empty rows', () => {
  it('play passes to the opponent after a turn', () => {
    const r = sow(position({ 0: 1, 12: 3 }), 0)
    expect(r.state.turn).toBe(1)
  })
  it('a player with no seeds in their row ends the round; the seeds left go to the row owner', () => {
    // Pit 0 -> 1. Pit 2 empty; beyond 3 (4) + opposite 10 (2) captured; pit 1 keeps 1 seed. Player 2 has no seeds left.
    const s = position({ 0: 1, 3: 4, 10: 2 }, { stores: [0, 0] })
    s.stores = [13, 50]
    const r = twice(s, 0, 1) // the capture earns a second sowing; then Player 2 has nothing to play
    expect(r.state.phase).toBe('round-over')
    expect(r.state.stores).toEqual([13 + 6 + 1, 50])
    expect(seedsOnBoard(r.state)).toBe(0)
    expect(invariantErrors(r.state)).toEqual([])
  })
  it('with the pass variant the stranded player passes and the other keeps sowing', () => {
    const s = position({ 0: 1, 3: 4, 10: 2, 5: 1 }, { config: { ...DEFAULT_CONFIG, stranded: 'pass' } })
    const r = twice(s, 0, 1)
    expect(r.state.phase).toBe('play')
    expect(r.state.turn).toBe(0)
    expect(r.state.events.some((e) => e.type === 'pass')).toBe(true)
  })
})

describe('rounds, refilling and piggy pits', () => {
  const overRound = (stores: [number, number]) => {
    const s = position({ 0: 1, 3: 4, 10: 2 })
    s.stores = stores
    return twice(s, 0, 1).state
  }
  it('refills five seeds per pit; seeds that cannot fill another pit stay in the store', () => {
    const over = overRound([13, 50]) // Player 1 ends on 20 seeds (4 pits), Player 2 on 50 (7 pits, 15 over)
    expect(over.phase).toBe('round-over')
    const r = apply(over, { type: 'next-round' })
    if (!r.ok) throw new Error(r.reason)
    expect(r.state.round).toBe(2)
    expect(r.state.pits.slice(0, 7).filter((n) => n === 5)).toHaveLength(4)
    expect(r.state.pits.slice(7).every((n) => n === 5)).toBe(true)
    expect(r.state.stores).toEqual([0, 15])
    expect(invariantErrors(r.state)).toEqual([])
  })
  it('pits that cannot be refilled are inactive: empty, never chosen, and skipped by sowing', () => {
    const over = overRound([13, 50])
    const next = apply(over, { type: 'next-round' })
    if (!next.ok) throw new Error(next.reason)
    const s = next.state
    expect(s.active.slice(0, 7)).toEqual([true, true, true, true, false, false, false])
    expect(routeNext(s, 3)).toBe(7)
    s.turn = 0
    expect(legalPits(s)).toEqual([0, 1, 2, 3])
    expect(apply(s, { type: 'sow', pit: 5 })).toEqual({ ok: false, reason: 'inactive-pit' })
  })
  it('the player who finished the last round second now goes first, and the first player alternates', () => {
    const next = apply(overRound([13, 50]), { type: 'next-round' })
    if (!next.ok) throw new Error(next.reason)
    expect(next.state.firstPlayer).toBe(1)
    expect(next.state.turn).toBe(1)
  })
  it('a pit that was inactive comes back when the player can pay for it again', () => {
    const s = overRound([13, 50])
    const r1 = apply(s, { type: 'next-round' })
    if (!r1.ok) throw new Error(r1.reason)
    const mid = r1.state
    mid.pits = Array(14).fill(0)
    mid.stores = [30, 40] // 70 total, board empty
    mid.phase = 'round-over'
    const r2 = apply(mid, { type: 'next-round' })
    if (!r2.ok) throw new Error(r2.reason)
    expect(r2.state.active.slice(0, 7).filter(Boolean)).toHaveLength(6)
    expect(r2.state.stores[0]).toBe(0)
  })
  it('the match goes on until a player cannot refill even one pit; the other wins', () => {
    const over = overRound([0, 63]) // Player 1 ends on 7 seeds: one pit; Player 2 on 63
    expect(over.phase).toBe('round-over')
    expect(fillable(over.stores[0], over.config)).toBe(1)
    const noRefill = position({ 0: 1, 3: 3, 10: 0 })
    noRefill.stores = [0, 66]
    const finished = twice(noRefill, 0, 1).state // captures 3, plus the stray seed: 4 seeds, under five
    expect(finished.phase).toBe('over')
    expect(finished.winner).toBe(1)
    expect(apply(finished, { type: 'sow', pit: 0 })).toEqual({ ok: false, reason: 'game-over' })
  })
  it('single-round mode ends the match after one round, by captured seeds', () => {
    const s = position({ 0: 1, 3: 4, 10: 2 }, { config: { ...DEFAULT_CONFIG, match: 'single' } })
    s.stores = [13, 50]
    const end = twice(s, 0, 1).state
    expect(end.phase).toBe('over')
    expect(end.winner).toBe(1)
    const draw = position({ 0: 1, 3: 4, 10: 2 }, { config: { ...DEFAULT_CONFIG, match: 'single' } })
    draw.stores = [28, 35]
    expect(twice(draw, 0, 1).state.winner).toBe('draw') // 28 + 7 = 35 each
  })
  it('regional pit counts work: four seeds per pit gives a 56-seed game', () => {
    const s = newGame({ seedsPerPit: 4 })
    expect(seedsOnBoard(s)).toBe(56)
    expect(invariantErrors(s)).toEqual([])
  })
  it('refill cannot be asked for in the middle of a round', () => {
    expect(apply(newGame(), { type: 'next-round' })).toEqual({ ok: false, reason: 'not-between-rounds' })
  })
})

describe('determinism and whole matches', () => {
  it('the same actions always give the same state', () => {
    const actions: Action[] = []
    let s = newGame()
    const rnd = createRandom('det')
    for (let i = 0; i < 40 && s.phase === 'play'; i++) {
      const pit = choosePit(s, 'easy', rnd)!
      actions.push({ type: 'sow', pit })
      s = (apply(s, { type: 'sow', pit }) as { state: State }).state
    }
    expect(replay(actions)).toEqual(s)
  })
  it('computer players of every level always choose legal pits and play whole matches with seeds conserved', () => {
    for (const [a, b] of [['easy', 'easy'], ['medium', 'easy'], ['hard', 'medium']] as const) {
      const rnd = createRandom(`match-${a}-${b}`)
      let s = newGame()
      for (let n = 0; n < 4000 && s.phase !== 'over'; n++) {
        if (s.phase === 'round-over') {
          const r = apply(s, { type: 'next-round' })
          if (!r.ok) throw new Error(r.reason)
          s = r.state
        } else {
          const pit = choosePit(s, s.turn === 0 ? a : b, rnd)
          expect(pit).toBeDefined()
          expect(legalPits(s)).toContain(pit)
          const r = apply(s, { type: 'sow', pit: pit! })
          if (!r.ok) throw new Error(r.reason)
          s = r.state
        }
        expect(invariantErrors(s)).toEqual([])
      }
      expect(s.phase).toBe('over')
      expect(s.winner).not.toBeNull()
    }
  })
  it('every level returns nothing when there is no legal pit', () => {
    const s = position({ 9: 3 })
    for (const level of LEVELS) expect(choosePit(s, level, createRandom('x'))).toBeUndefined()
  })
  it('hard takes an available capture that easy would miss', () => {
    const s = position({ 0: 2, 1: 1, 2: 1, 4: 3, 6: 2, 8: 3, 9: 4, 12: 1, 13: 2 })
    expect(choosePit(s, 'medium', createRandom('m'))).toBe(0)
    expect(choosePit(s, 'hard', createRandom('h'))).toBeDefined()
  })
})

import { TUTORIAL, stepStart } from './tutorial'

describe('tutorial', () => {
  it('every scripted step plays out on the real engine exactly as its text says', () => {
    let s = newGame()
    const log: string[] = []
    for (const step of TUTORIAL) {
      s = stepStart(step, s)
      if (step.expect !== undefined) {
        expect(legalPits(s)).toContain(step.expect)
        const r = apply(s, { type: 'sow', pit: step.expect })
        if (!r.ok) throw new Error(r.reason)
        log.push(`${step.id}:${r.state.stores}`)
        s = r.state
      }
      expect(invariantErrors(s)).toEqual([])
    }
    expect(log).toEqual(['sow:' + log[0].slice(4), 'saada:32,26', 'second:34,26', 'round:19,50', 'round-end:20,50'])
    expect(s.round).toBe(2)
    expect(s.stores).toEqual([0, 15])
    expect(s.active.slice(0, 7).filter(Boolean)).toHaveLength(4)
  })
  it('the first lesson move relays on the real opening board', () => {
    const r = apply(newGame(), { type: 'sow', pit: 2 })
    if (!r.ok) throw new Error(r.reason)
    expect(r.trace.some((t) => t.t === 'pick' && t.relay)).toBe(true)
  })
})
