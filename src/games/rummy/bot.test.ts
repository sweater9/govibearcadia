import { describe, expect, it } from 'vitest'
import { chooseAction, LEVELS } from './bot'
import { applyAction, newGame, type State } from './rules'

const deal = (level: (typeof LEVELS)[number], seed: string) => {
  let s: State = newGame(2, seed)
  let steps = 0
  while (s.phase !== 'done' && steps++ < 4000) {
    const next = applyAction(s, chooseAction(s, level))
    expect(next).not.toBe(s)
    s = next
  }
  return s
}

describe('computer levels', () => {
  it.each(LEVELS)('%s plays a legal deal to the end and replays identically', (level) => {
    const a = deal(level, 'levels-a')
    expect(a.phase).toBe('done')
    expect(deal(level, 'levels-a')).toEqual(a)
  })
  it('easy always draws from the stock while it has cards', () => {
    const s = newGame(2, 'levels-b')
    expect(chooseAction(s, 'easy')).toEqual({ type: 'draw', from: 'stock' })
  })
})
