import { applyAction, newGame, type Action, type State } from './rules'

const KEY = 'govibearcadia.poker.v1'
export type Session = { state: State; actions: Action[]; startedAt: number }

const isAction = (v: unknown): v is Action => {
  if (!v || typeof v !== 'object') return false
  const a = v as Action
  if (a.type === 'raise') return Number.isInteger(a.to)
  return ['fold', 'check', 'call', 'next'].includes(a.type)
}

/** A saved tournament is its seed, size and action list; loading replays them (bots included), so a damaged save is rejected rather than trusted. */
export function loadSession(seed?: string): Session | null {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!data || ![2, 3, 4, 5].includes(data.players) || typeof data.seed !== 'string' || (seed !== undefined && seed !== data.seed) ||
      !Number.isSafeInteger(data.startedAt) || data.startedAt < 0 || !Array.isArray(data.actions) || data.actions.length > 8000) return null
    let state = newGame(data.players, data.seed)
    for (const action of data.actions) {
      if (!isAction(action)) return null
      const next = applyAction(state, action)
      if (next === state) return null
      state = next
    }
    return { state, actions: data.actions, startedAt: data.startedAt }
  } catch {
    return null
  }
}

export function saveSession({ state, actions, startedAt }: Session) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ players: state.players.length, seed: state.seed, actions, startedAt }))
  } catch {
    /* the tournament stays playable when storage is unavailable */
  }
}
