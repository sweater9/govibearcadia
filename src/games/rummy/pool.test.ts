import { describe, expect, it } from 'vitest'
import { chooseAction } from './bot'
import { matchResult, newPool, replay, seatsIn, settle, startDeal, dealSeed, MAX_DEALS } from './pool'
import { nearlyWon } from './endgame'
import { applyAction, type Action, type State } from './rules'

/** Plays one whole deal with the computer for every seat. */
function playDeal(state: State): { state: State; actions: Action[] } {
  const actions: Action[] = []
  while (state.phase !== 'done' && actions.length < 800) {
    const a = chooseAction(state)
    actions.push(a)
    state = applyAction(state, a)
  }
  return { state, actions }
}

describe('pool rummy', () => {
  it('starts everyone on zero with nobody out, and deals the first hand from the game seed', () => {
    const pool = newPool(3)
    expect(pool).toEqual({ limit: 300, totals: [0, 0, 0], out: [false, false, false], deal: 0 })
    expect(dealSeed('abc', 0)).toBe('abc')
    expect(dealSeed('abc', 2)).not.toBe('abc')
    expect(startDeal(pool, 'abc').state.hands).toHaveLength(3)
  })
  it('adds a deal’s points to the totals and puts out whoever reaches the limit', () => {
    const pool = { ...newPool(3, 100), totals: [90, 20, 50] }
    const { state } = startDeal(pool, 's')
    const done = { ...state, phase: 'done' as const, scores: [15, 0, 80] }
    const next = settle(pool, [0, 1, 2], done)
    expect(next.totals).toEqual([105, 20, 130])
    expect(next.out).toEqual([true, false, true])
    expect(next.deal).toBe(1)
  })
  it('deals only to the players still in, keeping the seat order', () => {
    const pool = { ...newPool(4, 100), out: [false, true, false, true], deal: 1 }
    expect(seatsIn(pool)).toEqual([0, 2])
    const { state, seats } = startDeal(pool, 's')
    expect(seats).toEqual([0, 2])
    expect(state.hands).toHaveLength(2)
    expect(state.turn).toBe(1) // the player to move rotates with the deal
  })
  it('ends when one player is left, or when you are out, and the fewest points wins', () => {
    const base = newPool(3, 100)
    expect(matchResult({ ...base, totals: [10, 20, 30] }).over).toBe(false)
    expect(matchResult({ ...base, totals: [40, 100, 100], out: [false, true, true] })).toEqual({ over: true, winner: 0 })
    expect(matchResult({ ...base, totals: [100, 60, 50], out: [true, false, false] })).toEqual({ over: true, winner: 2 })
    expect(matchResult({ ...base, totals: [100, 120, 110], out: [true, true, true] })).toEqual({ over: true, winner: 0 })
    expect(matchResult({ ...base, totals: [10, 20, 30], deal: MAX_DEALS }).over).toBe(true)
  })
  it('plays a whole computer-only pool to a winner, with every deal replaying from its actions', () => {
    let pool = newPool(3, 100)
    const deals: Action[][] = []
    for (let d = 0; d < MAX_DEALS; d++) {
      const { state, seats } = startDeal(pool, 'whole-pool')
      const played = playDeal(state)
      expect(played.state.phase).toBe('done')
      deals.push(played.actions)
      pool = settle(pool, seats, played.state)
      if (matchResult(pool).over) break
    }
    expect(matchResult(pool).over).toBe(true)
    expect(pool.deal).toBeGreaterThan(1) // it took more than one deal: nobody was out after the first
    const back = replay('whole-pool', 3, 100, deals)
    expect(back).not.toBeNull()
    expect(back!.pool.deal).toBe(deals.length - 1)
    expect(back!.state.phase).toBe('done')
    // a deal that stops early, or an extra action, is rejected
    expect(replay('whole-pool', 3, 100, [deals[0].slice(0, 3), deals[1]])).toBeNull()
    expect(replay('whole-pool', 3, 100, [])).toBeNull()
  })
  it('the staged test pool ends with seat 0 declaring in the last deal', () => {
    const { seed, limit, past, actions, declare } = nearlyWon('pool-')
    expect(past.length).toBeGreaterThanOrEqual(1)
    const played = replay(seed, 2, limit, [...past, actions])
    expect(played).not.toBeNull()
    const finished = applyAction(played!.state, declare)
    expect(finished.winner).toBe(0)
    expect(matchResult(settle(played!.pool, played!.seats, finished)).winner).toBe(0)
  })
})
