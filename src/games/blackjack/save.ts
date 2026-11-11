import { applyAction, newGame, type Action, type State } from './rules'

const KEY = 'govibearcadia.blackjack.v1'
export type Session = { state: State; actions: Action[]; startedAt: number }

const isAction = (v: unknown): v is Action => {
  if (!v || typeof v !== 'object') return false
  const a = v as Action
  if (a.type === 'bet') return Number.isInteger(a.amount)
  return ['hit', 'stand', 'double', 'split', 'cashout'].includes(a.type)
}

/** A saved session is its seed and action list; loading replays them, so a damaged save is rejected rather than trusted. */
export function loadSession(seed?: string): Session | null {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!data || typeof data.seed !== 'string' || (seed !== undefined && seed !== data.seed) || !Number.isSafeInteger(data.startedAt) || data.startedAt < 0 ||
      !Array.isArray(data.actions) || data.actions.length > 6000) return null
    let state = newGame(data.seed)
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
    localStorage.setItem(KEY, JSON.stringify({ seed: state.seed, actions, startedAt }))
  } catch {
    /* the session stays playable when storage is unavailable */
  }
}
