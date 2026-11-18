import { describe, expect, it } from 'vitest'
import { MATCH_GAMES, MATCH_KEEP_MS, isMatchGame, MAX_QUEUE, REPAIR_MS, WAIT_MS, emptyState, expire, join, leave, nextExpiry, type MatchState } from './matchmaking'

let n = 0
const code = () => `CODE${++n}`
const hash = (s: string) => s.padEnd(64, '0')

describe('quick match pairing', () => {
  it('the first player waits and the second is paired with them, both getting one room code', () => {
    const a = join(emptyState(), hash('a'), 0, code)
    expect(a.result).toEqual({ kind: 'waiting', count: 1 })
    const b = join(a.state, hash('b'), 1000, code)
    expect(b.result.kind).toBe('matched')
    if (b.result.kind !== 'matched') return
    expect(b.result.partner).toBe(hash('a'))
    expect(b.state.waiting).toEqual([])
    expect(b.state.matched[hash('a')].code).toBe(b.result.code)
    expect(b.state.matched[hash('b')].code).toBe(b.result.code)
  })

  it('pairs first come, first served', () => {
    let s: MatchState = emptyState()
    s = join(s, hash('a'), 0, code).state
    s = join(s, hash('b'), 1, code).state // pairs with a
    s = join(s, hash('c'), 2, code).state // waits
    const d = join(s, hash('d'), 3, code)
    expect(d.result.kind === 'matched' && d.result.partner).toBe(hash('c'))
  })

  it('nobody can match themselves, even by joining twice', () => {
    const a = join(emptyState(), hash('a'), 0, code)
    const again = join(a.state, hash('a'), 5, code)
    expect(again.result).toEqual({ kind: 'waiting', count: 1 })
    expect(again.state.waiting).toHaveLength(1)
    expect(again.state.waiting[0].joinedAt).toBe(0)
  })

  it('a player whose connection dropped gets the same room code back, with no one to notify', () => {
    let s = join(emptyState(), hash('a'), 0, code).state
    const made = join(s, hash('b'), 1, code)
    s = made.state
    const rejoin = join(s, hash('a'), 20_000, code)
    expect(rejoin.result).toEqual({ kind: 'matched', code: made.result.kind === 'matched' ? made.result.code : '', partner: null })
    expect(rejoin.state.waiting).toEqual([])
  })

  it('a remembered match is forgotten after a minute', () => {
    let s = join(emptyState(), hash('a'), 0, code).state
    s = join(s, hash('b'), 1, code).state
    expect(Object.keys(expire(s, MATCH_KEEP_MS - 1).matched)).toHaveLength(2)
    expect(Object.keys(expire(s, MATCH_KEEP_MS + 1).matched)).toHaveLength(0)
  })

  it('the same two players are not paired again within ten minutes, but others still are', () => {
    let s = join(emptyState(), hash('a'), 0, code).state
    s = join(s, hash('b'), 1, code).state // a and b paired
    s = join(s, hash('a'), MATCH_KEEP_MS + 10, code).state // a waits (its match is forgotten)
    const b = join(s, hash('b'), MATCH_KEEP_MS + 20, code)
    expect(b.result.kind).toBe('waiting') // refused: just paired with a
    const c = join(b.state, hash('c'), MATCH_KEEP_MS + 30, code)
    expect(c.result.kind === 'matched' && c.result.partner).toBe(hash('a')) // a is still waiting, c is a stranger
    // After ten minutes a and b may meet again.
    const later = REPAIR_MS + MATCH_KEEP_MS + 100
    const x = join(emptyState(), hash('a'), later, code).state
    const y = join({ ...x, recent: [{ pair: `${hash('a')}|${hash('b')}`, at: 1 }] }, hash('b'), later, code)
    expect(y.result.kind).toBe('matched')
  })

  it('an entry that waited too long is dropped', () => {
    const s = join(emptyState(), hash('a'), 0, code).state
    expect(expire(s, WAIT_MS - 1).waiting).toHaveLength(1)
    expect(expire(s, WAIT_MS).waiting).toHaveLength(0)
    // a late joiner is then not paired with the expired entry
    expect(join(s, hash('b'), WAIT_MS + 1, code).result).toEqual({ kind: 'waiting', count: 1 })
  })

  it('leaving removes a waiting player and leaves a made match alone', () => {
    let s = join(emptyState(), hash('a'), 0, code).state
    expect(leave(s, hash('a')).waiting).toEqual([])
    s = join(s, hash('b'), 1, code).state
    expect(Object.keys(leave(s, hash('b')).matched)).toHaveLength(2)
  })

  it('refuses a new player when the queue is full, but still pairs one who can be paired', () => {
    let s = emptyState()
    // Fill the queue with players who were all just paired with "z", so none can pair with it.
    const recent = Array.from({ length: MAX_QUEUE }, (_, i) => ({ pair: [hash(`p${i}`), hash('z')].sort().join('|'), at: 0 }))
    s = { waiting: Array.from({ length: MAX_QUEUE }, (_, i) => ({ player: hash(`p${i}`), joinedAt: 0 })), matched: {}, recent }
    expect(join(s, hash('z'), 1, code).result).toEqual({ kind: 'queue-full' })
    expect(join(s, hash('fresh'), 1, code).result.kind).toBe('matched')
  })

  it('reports when the next entry will expire', () => {
    expect(nextExpiry(emptyState())).toBeNull()
    const s = join(emptyState(), hash('a'), 1000, code).state
    expect(nextExpiry(s)).toBe(1000 + WAIT_MS)
  })

  it('does not change the state it was given', () => {
    const s = join(emptyState(), hash('a'), 0, code).state
    const frozen = JSON.stringify(s)
    join(s, hash('b'), 1, code)
    leave(s, hash('a'))
    expire(s, WAIT_MS * 2)
    expect(JSON.stringify(s)).toBe(frozen)
  })

  it('the wait can be shortened (used by the end-to-end server only)', () => {
    const s = join(emptyState(), hash('a'), 0, code, 4000).state
    expect(expire(s, 3999, 4000).waiting).toHaveLength(1)
    expect(expire(s, 4000, 4000).waiting).toHaveLength(0)
    expect(nextExpiry(s, 4000)).toBe(4000)
  })

  it('only the five two-seat online games are queueable', () => {
    expect([...MATCH_GAMES]).toEqual(['connect-four', 'tic-tac-toe', 'checkers', 'nine-mens-morris', 'battleship'])
    expect(isMatchGame('checkers')).toBe(true)
    expect(isMatchGame('world-trip')).toBe(false)
    expect(isMatchGame('chess')).toBe(false)
  })
})
