import { applyAction, isTurnsEach, newGame, type Action, type State } from './rules'
import { BOARD } from './board'

const KEY = 'govibearcadia.world-trip.v1'
export type Match = { state: State; actions: Action[]; startedAt: number; computers: number }

function isAction(value: unknown): value is Action {
  if (!value || typeof value !== 'object') return false
  const a = value as Action
  switch (a.type) {
    case 'roll': case 'buy': case 'skip': case 'accept': case 'decline': case 'end': case 'drop': return true
    case 'bid': return Number.isSafeInteger(a.amount)
    case 'upgrade': return Number.isInteger(a.space) && a.space >= 0 && a.space < BOARD.length
    case 'offer': return !!a.offer && Number.isInteger(a.offer.space) && Number.isInteger(a.offer.buyer) && Number.isSafeInteger(a.offer.price)
    default: return false
  }
}

/** A saved match is its seed, settings and action list; loading replays them, so a damaged save is rejected rather than trusted. */
export function loadMatch(seed?: string): Match | null {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!data || ![2, 3, 4].includes(data.count) || !isTurnsEach(data.turnsEach) || typeof data.seed !== 'string' ||
      (seed !== undefined && seed !== data.seed) || !Number.isSafeInteger(data.startedAt) || data.startedAt < 0 ||
      !Array.isArray(data.actions) || data.actions.length > 4000) return null
    const computers = data.computers === undefined ? 0 : data.computers
    if (!Number.isInteger(computers) || computers < 0 || computers >= data.count) return null
    let state = newGame(data.count, data.seed, data.turnsEach)
    for (const action of data.actions) {
      if (!isAction(action)) return null
      const next = applyAction(state, action)
      if (next === state) return null
      state = next
    }
    return { state, actions: data.actions, startedAt: data.startedAt, computers }
  } catch {
    return null
  }
}

export function saveMatch({ state, actions, startedAt, computers }: Match) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ count: state.players.length, turnsEach: state.turnsEach, seed: state.seed, actions, startedAt, computers }))
  } catch {
    /* the match stays playable when storage is unavailable */
  }
}
