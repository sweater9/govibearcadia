import { describe, expect, it } from 'vitest'
import { RING, RING_SIZE, HOME_COLUMN, YARD, cellOf, isSafeRing, ringIndex } from './board'
import { chooseAction } from './bot'
import { applyAction, homeCount, legalMoves, newGame, seatsFor, type State } from './rules'
import { loadMatch, saveMatch } from './save'

/** A state in the move phase with chosen dice and token positions, for exact rule checks. */
function setup(tokens: number[][], dice: number, turn = 0, seats = [0, 2]): State {
  return { ...newGame(seats.length, 'rule-test'), seats, tokens, turn, phase: 'move', dice, rolledBy: turn }
}
const yard = [-1, -1, -1, -1]

describe('board', () => {
  it('has 52 distinct ring squares, each touching the next (the corners turn diagonally)', () => {
    expect(new Set(RING.map(([r, c]) => `${r},${c}`)).size).toBe(RING_SIZE)
    for (let i = 0; i < RING_SIZE; i++) {
      const [a, b] = [RING[i], RING[(i + 1) % RING_SIZE]]
      expect(Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]))).toBe(1)
    }
  })
  it('puts each home column, yard and start in its own corner of the board', () => {
    expect(RING[0]).toEqual([13, 6]) // seat 0 starts bottom left
    expect(YARD[0].every(([r, c]) => r > 8 && c < 6)).toBe(true)
    expect(HOME_COLUMN[0].every(([r, c]) => c === 7 && r > 8)).toBe(true)
    expect(cellOf(0, 0, 56)[0]).toBeGreaterThan(7)
  })
  it('marks the four starts and four stars as safe, and nothing else', () => {
    expect([...Array(RING_SIZE).keys()].filter(isSafeRing)).toEqual([0, 8, 13, 21, 26, 34, 39, 47])
  })
})

describe('moving', () => {
  it('needs a six to leave the yard, and a six lands on the start square', () => {
    expect(legalMoves(setup([yard, yard], 5))).toEqual([])
    const s = applyAction(setup([yard, yard], 6), { type: 'move', token: 2 })
    expect(s.tokens[0][2]).toBe(0)
    expect(s.phase).toBe('roll')
    expect(s.turn).toBe(0) // a six rolls again
  })
  it('needs the exact number to finish', () => {
    expect(legalMoves(setup([[53, -1, -1, -1], yard], 4))).toEqual([])
    expect(legalMoves(setup([[53, -1, -1, -1], yard], 3))).toEqual([0])
    const s = applyAction(setup([[53, 56, 56, 56], yard], 3), { type: 'move', token: 0 })
    expect(s.phase).toBe('done')
    expect(s.winner).toBe(0)
  })
  it('rejects a move that is not legal and returns the same state', () => {
    const s = setup([yard, yard], 3)
    expect(applyAction(s, { type: 'move', token: 0 })).toBe(s)
    expect(applyAction(s, { type: 'roll' })).toBe(s)
  })
  it('passes the turn after a non-six move', () => {
    const s = applyAction(setup([[10, -1, -1, -1], yard], 3), { type: 'move', token: 0 })
    expect(s.turn).toBe(1)
    expect(s.phase).toBe('roll')
  })
})

describe('capture', () => {
  // Seat 0 at progress p sits on ring p; seat 2 at progress q sits on ring 26 + q.
  it('sends an opponent on an unsafe square back to the yard and rolls again', () => {
    expect(ringIndex(2, 3)).toBe(29)
    const s = applyAction(setup([[26, -1, -1, -1], [3, -1, -1, -1]], 3), { type: 'move', token: 0 })
    expect(s.tokens[1][0]).toBe(-1)
    expect(s.captures[0]).toBe(1)
    expect(s.turn).toBe(0)
    expect(s.message).toContain('Captured')
  })
  it('does not capture on a safe square', () => {
    expect(isSafeRing(ringIndex(2, 8))).toBe(true) // 34 is a star
    const s = applyAction(setup([[30, -1, -1, -1], [8, -1, -1, -1]], 4), { type: 'move', token: 0 })
    expect(s.tokens[1][0]).toBe(8)
    expect(s.captures[0]).toBe(0)
  })
  it('never captures a token in the home column or the yard', () => {
    const s = applyAction(setup([[10, -1, -1, -1], [-1, 52, -1, -1]], 2), { type: 'move', token: 0 })
    expect(s.tokens[1]).toEqual([-1, 52, -1, -1])
  })
})

describe('rolling', () => {
  it('is a function of the seed and roll count, and passes when nothing can move', () => {
    const a = applyAction(newGame(2, 's1'), { type: 'roll' })
    const b = applyAction(newGame(2, 's1'), { type: 'roll' })
    expect(a).toEqual(b)
    expect(a.dice).toBeGreaterThanOrEqual(1)
    expect(a.dice).toBeLessThanOrEqual(6)
    if (a.dice !== 6) expect(a.turn).toBe(1) // nothing to move: pass
  })
  it('loses the turn on a third six in a row', () => {
    let seed = ''
    for (let i = 0; i < 4000 && !seed; i++) {
      let s = newGame(2, `six-${i}`)
      const roll = () => (s = applyAction(s, { type: 'roll' }))
      roll()
      if (s.dice !== 6) continue
      s = applyAction(s, { type: 'move', token: 0 })
      roll()
      if (s.dice !== 6) continue
      s = applyAction(s, { type: 'move', token: 1 })
      roll()
      if (s.dice === 6) seed = `six-${i}`
    }
    expect(seed).not.toBe('')
    let s = newGame(2, seed)
    s = applyAction(s, { type: 'roll' })
    s = applyAction(s, { type: 'move', token: 0 })
    s = applyAction(s, { type: 'roll' })
    s = applyAction(s, { type: 'move', token: 1 })
    s = applyAction(s, { type: 'roll' })
    expect(s.message).toContain('Three sixes')
    expect(s.turn).toBe(1)
  })
})

describe('whole matches', () => {
  function playOut(seed: string, count: number) {
    let s = newGame(count, seed)
    const actions = []
    for (let i = 0; s.phase !== 'done'; i++) {
      const action = chooseAction(s)
      const next = applyAction(s, action)
      expect(next).not.toBe(s) // the computer never picks an illegal action
      actions.push(action)
      s = next
      if (i > 6000) throw new Error('match did not finish')
    }
    return { s, actions }
  }
  it('computers finish matches for 2, 3 and 4 seats with a winner who has all four tokens home', () => {
    for (const n of [2, 3, 4]) for (const seed of ['a', 'b', 'c']) {
      const { s } = playOut(`${seed}-${n}`, n)
      expect(s.winner).not.toBeNull()
      expect(homeCount(s, s.winner!)).toBe(4)
    }
  })
  it('is deterministic', () => {
    expect(playOut('same', 4).s).toEqual(playOut('same', 4).s)
  })
  it('uses opposite corners for two players', () => {
    expect(seatsFor(2)).toEqual([0, 2])
  })
  it('reloads exactly from its save', () => {
    const store = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }, configurable: true })
    const { s, actions } = playOut('save', 3)
    saveMatch({ state: s, actions, startedAt: 9, computers: 2 })
    const back = loadMatch()
    expect(back?.state).toEqual(s)
    expect(back?.computers).toBe(2)
    store.set('govibearcadia.ludo.v1', '{"count":2}')
    expect(loadMatch()).toBeNull()
  })
})
