import { applyAction, newGame, type Action, type State } from './rules'

/**
 * Pool Indian Rummy: deals are played one after another and each player's points add up. A player whose total
 * reaches the limit is out. The pool ends when one player is left under the limit (or the human is out), and the
 * player with the fewest points wins it. Pure rules, no React or browser APIs.
 */
export const POOL_LIMITS = [100, 200, 300] as const
export const DEFAULT_LIMIT = 300
export const MAX_DEALS = 40

export type Pool = { limit: number; totals: number[]; out: boolean[]; deal: number }

export const isLimit = (n: unknown): n is number => POOL_LIMITS.includes(n as never)
export const newPool = (players: number, limit: number = DEFAULT_LIMIT): Pool => ({ limit, totals: Array(players).fill(0), out: Array(players).fill(false), deal: 0 })
/** Seats still in the pool, in seat order (seat 0 is the person playing). */
export const seatsIn = (pool: Pool): number[] => pool.out.flatMap((o, i) => (o ? [] : [i]))
/** The first deal uses the game's own seed, so a seeded link still deals the same first hand. */
export const dealSeed = (seed: string, deal: number) => (deal === 0 ? seed : `${seed}:deal${deal}`)

/** Deals to the seats still in. The player to move rotates each deal. Hand index i belongs to `seats[i]`. */
export function startDeal(pool: Pool, seed: string): { state: State; seats: number[] } {
  const seats = seatsIn(pool)
  const state = newGame(seats.length, dealSeed(seed, pool.deal))
  return { state: { ...state, turn: pool.deal % seats.length }, seats }
}

/** Adds a finished deal's points to the totals and puts out anyone who reached the limit. */
export function settle(pool: Pool, seats: number[], state: State): Pool {
  const totals = pool.totals.slice()
  const out = pool.out.slice()
  state.scores?.forEach((points, i) => {
    totals[seats[i]] += points
    if (totals[seats[i]] >= pool.limit) out[seats[i]] = true
  })
  return { ...pool, totals, out, deal: pool.deal + 1 }
}

/** Whether the pool is finished, and who has the fewest points. Only meaningful for a pool that already includes the last deal. */
export function matchResult(pool: Pool): { over: boolean; winner: number } {
  const winner = pool.totals.reduce((best, total, i) => (total < pool.totals[best] ? i : best), 0)
  const left = seatsIn(pool).length
  return { over: pool.out[0] || left <= 1 || pool.deal >= MAX_DEALS, winner }
}

export type Played = { pool: Pool; seats: number[]; state: State; actions: Action[]; past: Action[][] }

/** Rebuilds a pool from its seed and every deal's actions; null when anything does not replay. */
export function replay(seed: string, players: number, limit: number, deals: Action[][]): Played | null {
  if (!deals.length || deals.length > MAX_DEALS) return null
  let pool = newPool(players, limit)
  let { state, seats } = startDeal(pool, seed)
  for (let d = 0; d < deals.length; d++) {
    for (const action of deals[d]) {
      const next = applyAction(state, action)
      if (next === state) return null
      state = next
    }
    if (d < deals.length - 1) {
      if (state.phase !== 'done') return null
      pool = settle(pool, seats, state)
      if (matchResult(pool).over) return null
      ;({ state, seats } = startDeal(pool, seed))
    }
  }
  return { pool, seats, state, actions: deals[deals.length - 1], past: deals.slice(0, -1) }
}
