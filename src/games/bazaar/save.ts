import { applyAction, newGame, type Action, type State } from './rules'

const KEY = 'govibearcadia.bazaar.v1'
export type Match = { state: State; actions: Action[]; startedAt: number }

function isAction(value: unknown): value is Action {
  if (!value || typeof value !== 'object') return false
  const action = value as Action
  switch (action.type) {
    case 'roll': case 'buy': case 'skip': case 'accept': case 'decline': case 'end':
      return true
    case 'upgrade':
      return Number.isInteger(action.property)
    case 'offer':
      return !!action.offer && Number.isInteger(action.offer.property) &&
        Number.isInteger(action.offer.buyer) && Number.isSafeInteger(action.offer.price)
    default:
      return false
  }
}

export function loadMatch(seed?: string): Match | null {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!data || ![2, 3, 4].includes(data.count) || typeof data.seed !== 'string' ||
        (seed !== undefined && seed !== data.seed) || !Number.isSafeInteger(data.startedAt) ||
        data.startedAt < 0 || !Array.isArray(data.actions) || data.actions.length > 256) return null
    let state = newGame(data.count, data.seed)
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

export function saveMatch({ state, actions, startedAt }: Match) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      count: state.players.length, seed: state.seed, actions, startedAt,
    }))
  } catch {
    // The active match remains playable when browser storage is unavailable.
  }
}
