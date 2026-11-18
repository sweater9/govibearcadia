import { describe, expect, it } from 'vitest'
import { createRandom } from '../lib/rng'
import { newGame as c4 } from './connect4/rules'
import { aiMove as c4Move } from './connect4/rules'
import { newGame as ck, aiStep } from './checkers/rules'

// The hardest computer (Ananya) searches one ply deeper than the default; its first move must still be quick.
describe('hardest computer stays fast', () => {
  it('Connect Four depth 5', () => {
    const t = Date.now()
    expect(c4Move(c4(), createRandom('s'), 5)).toBeGreaterThanOrEqual(0)
    expect(Date.now() - t).toBeLessThan(1500)
  })
  it('Checkers depth 5', () => {
    const t = Date.now()
    expect(aiStep(ck(), createRandom('s'), 5)).not.toBeNull()
    expect(Date.now() - t).toBeLessThan(1500)
  })
})
