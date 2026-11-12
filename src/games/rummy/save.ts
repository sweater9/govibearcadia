import { isLimit, replay, DEFAULT_LIMIT, type Pool } from './pool'
import { type Action, type State } from './rules'

const KEY = 'govibearcadia.rummy.v1'
/** `pool` is the pool before the current deal; `seats[i]` is the seat holding hand i; `past` holds the actions of the deals already played. */
export type Match = { seed: string; pool: Pool; seats: number[]; state: State; actions: Action[]; past: Action[][]; startedAt: number; layout: number[][] }

const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 106
const isAction = (v: unknown): v is Action => {
  if (!v || typeof v !== 'object') return false
  const a = v as Action
  if (a.type === 'draw') return a.from === 'stock' || a.from === 'discard'
  if (a.type === 'discard') return isId(a.card)
  return a.type === 'declare' && isId(a.card) && Array.isArray(a.groups) && a.groups.every((g) => Array.isArray(g) && g.every(isId))
}

/** A saved pool is its seed, size, limit and every deal's action list; loading replays them, so a damaged save is rejected rather than trusted. */
export function loadMatch(seed?: string): Match | null {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!data || ![2, 3, 4].includes(data.players) || typeof data.seed !== 'string' || (seed !== undefined && seed !== data.seed) ||
      !Number.isSafeInteger(data.startedAt) || data.startedAt < 0) return null
    const limit = data.limit === undefined ? DEFAULT_LIMIT : data.limit
    if (!isLimit(limit)) return null
    // A save from before pools holds a single `actions` list: it is one deal.
    const deals: unknown = data.deals ?? [data.actions]
    if (!Array.isArray(deals) || deals.length > 40 || !deals.every((d) => Array.isArray(d) && d.length <= 2000 && d.every(isAction))) return null
    const played = replay(data.seed, data.players, limit, deals as Action[][])
    if (!played) return null
    const layout: number[][] = Array.isArray(data.layout) && data.layout.length <= 14 && data.layout.every((g: unknown) => Array.isArray(g) && g.length <= 14 && g.every(isId)) ? data.layout : []
    return { seed: data.seed, ...played, startedAt: data.startedAt, layout }
  } catch {
    return null
  }
}

export function saveMatch({ seed, pool, actions, past, startedAt, layout }: Match) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ players: pool.totals.length, seed, limit: pool.limit, deals: [...past, actions], startedAt, layout }))
  } catch {
    /* the game stays playable when storage is unavailable */
  }
}
