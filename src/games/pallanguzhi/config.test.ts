import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { choosePit } from './ai'
import { SEED_OPTIONS, SOWING_OPTIONS, describeConfig, isDefaultConfig, normaliseConfig } from './config'
import { DEFAULT_CONFIG, apply, invariantErrors, legalPits, newGame, seedsOnBoard, type Config, type State } from './rules'

describe('rule choices', () => {
  it('anything stored is clamped to a rule set the engine supports', () => {
    expect(normaliseConfig(null)).toEqual(DEFAULT_CONFIG)
    expect(normaliseConfig({ seedsPerPit: 99, maxSowings: 0, stranded: 'x', match: 'y' })).toEqual(DEFAULT_CONFIG)
    expect(normaliseConfig({ seedsPerPit: 4, maxSowings: 3, zeroCaptureGrantsSecond: true, stranded: 'pass', match: 'single' })).toEqual({ seedsPerPit: 4, maxSowings: 3, zeroCaptureGrantsSecond: true, stranded: 'pass', match: 'single' })
  })
  it('knows the default and describes every rule', () => {
    expect(isDefaultConfig(DEFAULT_CONFIG)).toBe(true)
    expect(isDefaultConfig({ ...DEFAULT_CONFIG, seedsPerPit: 4 })).toBe(false)
    expect(describeConfig(DEFAULT_CONFIG)).toHaveLength(5)
    expect(describeConfig({ ...DEFAULT_CONFIG, seedsPerPit: 6 })[0]).toContain('84')
  })
})

describe('every combination of choices plays correctly', () => {
  const combos: Config[] = []
  for (const seedsPerPit of SEED_OPTIONS)
    for (const maxSowings of SOWING_OPTIONS)
      for (const zeroCaptureGrantsSecond of [false, true])
        for (const stranded of ['owner-keeps', 'pass'] as const)
          for (const match of ['match', 'single'] as const) combos.push({ seedsPerPit, maxSowings, zeroCaptureGrantsSecond, stranded, match })

  it('the board starts with the chosen seed count and the right total', () => {
    for (const n of SEED_OPTIONS) {
      const s = newGame({ seedsPerPit: n })
      expect(s.pits.every((p) => p === n)).toBe(true)
      expect(seedsOnBoard(s)).toBe(n * 14)
    }
  })

  it('computer-vs-computer games keep seeds conserved and never exceed the allowed sowings; single rounds always finish, matches keep making progress', () => {
    let k = 0
    for (const config of combos) {
      const random = createRandom(`cfg-${k++}`)
      let s: State = newGame(config)
      let steps = 0
      while (s.phase !== 'over' && steps < 20_000) {
        let r
        if (s.phase === 'round-over') r = apply(s, { type: 'next-round' }, false)
        else {
          const pit = choosePit(s, 'easy', random)
          if (pit === undefined) break
          r = apply(s, { type: 'sow', pit }, false)
        }
        if (!r.ok) throw new Error(`illegal move under ${JSON.stringify(config)}: ${r.reason}`)
        s = r.state
        expect(s.sowings).toBeLessThanOrEqual(config.maxSowings)
        expect(invariantErrors(s), JSON.stringify(config)).toEqual([])
        steps++
      }
      if (config.match === 'single') expect(s.phase, `a single round did not finish: ${JSON.stringify(config)}`).toBe('over')
      else expect(s.phase === 'over' || s.round >= 3, `no progress: ${JSON.stringify(config)}`).toBe(true)
    }
  })

  it('one sowing a turn never earns a second sowing', () => {
    const s = newGame({ maxSowings: 1 })
    for (const pit of legalPits(s)) {
      const r = apply(s, { type: 'sow', pit }, false)
      if (r.ok) expect(r.state.sowings === 0 || r.state.phase !== 'play').toBe(true)
    }
  })
})

describe('a lone seed cannot keep a round going for ever', () => {
  it("in the 'pass' variant a single circling seed ends the round after QUIET_LIMIT sowings, and the seed goes to its row's owner", () => {
    let s: State = newGame({ stranded: 'pass', match: 'single' })
    s.pits = Array(14).fill(0)
    s.pits[7] = 1
    s.turn = 1
    s.stores = [34, 35]
    for (let i = 0; i < 200 && s.phase === 'play'; i++) {
      const pit = legalPits(s)[0]
      const r = apply(s, { type: 'sow', pit }, false)
      if (!r.ok) throw new Error(r.reason)
      s = r.state
    }
    expect(s.phase).toBe('over')
    expect(s.stores[0] + s.stores[1]).toBe(70)
  })
})
