import { applyAction, newGame, type Action, type State } from './rules'

const KEY = 'govibearcadia.rummy.v1'
export type Match = { state: State; actions: Action[]; startedAt: number; layout: number[][] }

const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 106
const isAction = (v: unknown): v is Action => {
  if (!v || typeof v !== 'object') return false
  const a = v as Action
  if (a.type === 'draw') return a.from === 'stock' || a.from === 'discard'
  if (a.type === 'discard') return isId(a.card)
  return a.type === 'declare' && isId(a.card) && Array.isArray(a.groups) && a.groups.every((g) => Array.isArray(g) && g.every(isId))
}

/** A saved game is its seed, size and action list; loading replays them, so a damaged save is rejected rather than trusted. */
export function loadMatch(seed?: string): Match | null {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!data || ![2, 3, 4].includes(data.players) || typeof data.seed !== 'string' || (seed !== undefined && seed !== data.seed) ||
      !Number.isSafeInteger(data.startedAt) || data.startedAt < 0 || !Array.isArray(data.actions) || data.actions.length > 2000) return null
    let state = newGame(data.players, data.seed)
    for (const action of data.actions) {
      if (!isAction(action)) return null
      const next = applyAction(state, action)
      if (next === state) return null
      state = next
    }
    const layout: number[][] = Array.isArray(data.layout) && data.layout.length <= 14 && data.layout.every((g: unknown) => Array.isArray(g) && g.length <= 14 && g.every(isId)) ? data.layout : []
    return { state, actions: data.actions, startedAt: data.startedAt, layout }
  } catch {
    return null
  }
}

export function saveMatch({ state, actions, startedAt, layout }: Match) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ players: state.players, seed: state.seed, actions, startedAt, layout }))
  } catch {
    /* the game stays playable when storage is unavailable */
  }
}
