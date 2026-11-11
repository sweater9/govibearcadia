import { applyAction, newGame, type Action, type State } from './rules'

const KEY = 'govibearcadia.ludo.v1'
export type Match = { state: State; actions: Action[]; startedAt: number; computers: number }

function isAction(value: unknown): value is Action {
  if (!value || typeof value !== 'object') return false
  const a = value as Action
  return a.type === 'roll' || (a.type === 'move' && Number.isInteger(a.token) && a.token >= 0 && a.token < 4)
}

/** A saved match is its seed, settings and action list; loading replays them, so a damaged save is rejected rather than trusted. */
export function loadMatch(seed?: string): Match | null {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!data || ![2, 3, 4].includes(data.count) || typeof data.seed !== 'string' || (seed !== undefined && seed !== data.seed) ||
      !Number.isSafeInteger(data.startedAt) || data.startedAt < 0 || !Array.isArray(data.actions) || data.actions.length > 4000 ||
      !Number.isInteger(data.computers) || data.computers < 0 || data.computers >= data.count) return null
    let state = newGame(data.count, data.seed)
    for (const action of data.actions) {
      if (!isAction(action)) return null
      const next = applyAction(state, action)
      if (next === state) return null
      state = next
    }
    return { state, actions: data.actions, startedAt: data.startedAt, computers: data.computers }
  } catch {
    return null
  }
}

export function saveMatch({ state, actions, startedAt, computers }: Match) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ count: state.seats.length, computers, seed: state.seed, actions, startedAt }))
  } catch {
    /* the match stays playable when storage is unavailable */
  }
}
