import { describe, expect, it } from 'vitest'
import { TOKENS, assignTokens, isToken, validTokens } from './tokens'

describe('tokens', () => {
  it('offers eight pieces with a car instead of a cat, each with a name and a shape', () => {
    expect(TOKENS.map((t) => t.name)).toEqual(['Crown', 'Rocket', 'Car', 'Anchor', 'Star', 'Bolt', 'Heart', 'Top hat'])
    expect(new Set(TOKENS.map((t) => t.id)).size).toBe(8)
    expect(TOKENS.every((t) => t.path.length > 20)).toBe(true)
  })
  it('gives every seat a different piece, honouring the first person\'s choice', () => {
    for (const people of [[0], [0, 2], [0, 1, 2], [0, 1, 2, 3]] as const) {
      const t = assignTokens(people, 5, 'x')
      expect(new Set(t).size).toBe(4)
      expect(t.every(isToken)).toBe(true)
      expect(t[0]).toBe(5)
    }
  })
  it('gives the next person the next free piece when two choose alike', () => {
    expect(assignTokens([0, 2], 0, 'x').slice(0, 3)).toContain(1)
    expect(assignTokens([0, 2], 0, 'x')[2]).toBe(1)
  })
  it('is deterministic, and spreads the computer\'s pieces by seed', () => {
    expect(assignTokens([0], null, 'same')).toEqual(assignTokens([0], null, 'same'))
    const seen = new Set(['a', 'bb', 'ccc', 'dddd', 'eeeee', 'f6'].map((s) => assignTokens([0], null, s)[1]))
    expect(seen.size).toBeGreaterThan(1)
  })
  it('ignores a damaged saved choice', () => {
    expect(validTokens([0, 1, 2, 3])).toBe(true)
    for (const bad of [[0, 0, 1, 2], [0, 1, 2], [0, 1, 2, 9], 'x', null, [0, 1, 2, 1.5]]) expect(validTokens(bad)).toBe(false)
  })
})
