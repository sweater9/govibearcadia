import { describe, expect, it } from 'vitest'
import { createLimiter } from './ratelimit'

describe('createLimiter', () => {
  it('allows up to max hits per window, then refuses', () => {
    const l = createLimiter(3, 1000)
    expect([l.hit('a', 0), l.hit('a', 1), l.hit('a', 2), l.hit('a', 3)]).toEqual([true, true, true, false])
  })
  it('lets a key back in once the window has passed', () => {
    const l = createLimiter(1, 1000)
    expect(l.hit('a', 0)).toBe(true)
    expect(l.hit('a', 999)).toBe(false)
    expect(l.hit('a', 1000)).toBe(true)
  })
  it('keeps keys independent', () => {
    const l = createLimiter(1, 1000)
    expect(l.hit('a', 0)).toBe(true)
    expect(l.hit('b', 0)).toBe(true)
  })
  it('forgets the oldest keys beyond maxKeys so memory stays bounded', () => {
    const l = createLimiter(1, 10_000, 2)
    l.hit('a', 0)
    l.hit('b', 1)
    l.hit('c', 2)
    expect(l.hit('a', 3)).toBe(true) // a was forgotten
    expect(l.hit('c', 3)).toBe(false)
  })
})
