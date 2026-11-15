import { describe, expect, it } from 'vitest'
import { bestAfter } from './bests'

describe('bestAfter', () => {
  it('a first ever run sets the best but is not announced', () => {
    expect(bestAfter(undefined, 300)).toEqual({ best: 300, isNew: false })
  })
  it('beating the stored best is a new best', () => {
    expect(bestAfter({ highScore: 300, plays: 2 }, 400)).toEqual({ best: 400, isNew: true })
  })
  it('tying or falling short keeps the best and is not new', () => {
    expect(bestAfter({ highScore: 300, plays: 2 }, 300)).toEqual({ best: 300, isNew: false })
    expect(bestAfter({ highScore: 300, plays: 2 }, 120)).toEqual({ best: 300, isNew: false })
  })
  it('a zero score never counts as a best', () => {
    expect(bestAfter({ highScore: 0, plays: 3 }, 0)).toEqual({ best: 0, isNew: false })
  })
})
