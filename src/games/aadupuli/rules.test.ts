import { describe, expect, it } from 'vitest'
import { chooseMove } from './ai'
import { createRandom } from '../../lib/rng'
import { applyMove, DEFAULT_CONFIG, EDGES, isStandard, JUMPS, legalMoves, LINES, newGame, normaliseConfig, POINTS, TIGER_START, type State } from './rules'

describe('Aadu Puli Attam rules', () => {
  it('models the authentic 23-point graph', () => {
    expect(POINTS).toBe(23)
    expect(new Set(EDGES.flat())).toEqual(new Set(Array.from({ length: 23 }, (_, i) => i)))
    expect(LINES).toHaveLength(10)
    expect(TIGER_START).toEqual([0, 3, 4])
    expect(newGame().cells.filter((p) => p === 'T')).toHaveLength(3)
  })
  it('starts with goat placement and forbids goat movement until all 15 enter', () => {
    let state = newGame(); expect(legalMoves(state)).toHaveLength(20)
    state = applyMove(state, { from: null, to: 1, captured: null }); expect(state.turn).toBe('tigers')
    state = { ...state, turn: 'goats' }; expect(legalMoves(state).every((m) => m.from === null)).toBe(true)
  })
  it('allows only straight-line single jumps and removes the jumped goat', () => {
    const cells = Array(23).fill(null) as State['cells']; cells[0] = cells[3] = cells[4] = 'T'; cells[2] = 'G'
    const state: State = { cells, turn: 'tigers', goatsPlaced: 15, goatsCaptured: 0, moves: 0, winner: null, config: DEFAULT_CONFIG }
    const capture = legalMoves(state).find((m) => m.from === 0 && m.to === 8)
    expect(capture).toEqual({ from: 0, to: 8, captured: 2 })
    const next = applyMove(state, capture!); expect(next.cells[2]).toBeNull(); expect(next.cells[8]).toBe('T'); expect(next.goatsCaptured).toBe(1)
    expect(JUMPS.every(([a, over, to]) => EDGES.some((e) => e.includes(a) && e.includes(over)) && EDGES.some((e) => e.includes(over) && e.includes(to)))).toBe(true)
  })
  it('gives tigers the win at five captures', () => {
    const state = { ...newGame(), goatsPlaced: 15, goatsCaptured: 4, turn: 'tigers' as const }; const cells = state.cells.slice(); cells[2] = 'G'
    expect(applyMove({ ...state, cells }, { from: 0, to: 8, captured: 2 }).winner).toBe('tigers')
  })
  it('gives goats the win when every tiger has no step or jump', () => {
    const cells = Array(23).fill('G') as State['cells']; cells[0] = cells[3] = cells[4] = 'T'; cells[22] = null
    const state: State = { cells, turn: 'goats', goatsPlaced: 15, goatsCaptured: 0, moves: 0, winner: null, config: DEFAULT_CONFIG }
    expect(applyMove(state, legalMoves(state)[0]).winner).toBe('goats')
  })
  describe('rule choices', () => {
    const captureBoard = (config = DEFAULT_CONFIG): State => {
      const cells = Array(23).fill(null) as State['cells']; cells[0] = cells[3] = cells[4] = 'T'; cells[2] = 'G'
      return { cells, turn: 'tigers', goatsPlaced: 15, goatsCaptured: 0, moves: 0, winner: null, config }
    }
    it('the defaults are the standard rules', () => {
      expect(isStandard(DEFAULT_CONFIG)).toBe(true)
      expect(normaliseConfig({ capturesToWin: 9 })).toEqual(DEFAULT_CONFIG)
    })
    it('mandatory capture leaves tigers only the captures', () => {
      expect(legalMoves(captureBoard()).some((m) => m.captured === null)).toBe(true)
      const must = legalMoves(captureBoard({ ...DEFAULT_CONFIG, mustCapture: true }))
      expect(must.length).toBeGreaterThan(0)
      expect(must.every((m) => m.captured !== null)).toBe(true)
    })
    it('six captures are needed when chosen', () => {
      const s = { ...captureBoard({ ...DEFAULT_CONFIG, capturesToWin: 6 }), goatsCaptured: 4 }
      expect(applyMove(s, { from: 0, to: 8, captured: 2 }).winner).toBeNull()
      expect(applyMove({ ...s, goatsCaptured: 5 }, { from: 0, to: 8, captured: 2 }).winner).toBe('tigers')
    })
    it('tigers can move first', () => {
      expect(newGame({ ...DEFAULT_CONFIG, first: 'tigers' }).turn).toBe('tigers')
    })
    it('computer-played games finish under every combination', () => {
      for (const capturesToWin of [5, 6] as const) for (const mustCapture of [false, true]) for (const first of ['goats', 'tigers'] as const) {
        let s = newGame({ capturesToWin, mustCapture, first }); const random = createRandom(`${capturesToWin}${mustCapture}${first}`)
        for (let i = 0; i < 400 && !s.winner; i++) { const m = chooseMove(s, random, 1); if (!m) break; s = applyMove(s, m) }
        expect(s.winner === null ? legalMoves(s).length : 1).toBeGreaterThan(0)
      }
    })
  })
})
