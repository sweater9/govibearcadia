import { MIN_PLAYERS, MAX_PLAYERS } from './colours'
import { applyAction, isTurnsEach, newGame, type Action, type State } from './rules'
import { isAction } from './actions'

const KEY = 'govibearcadia.world-trip.v1'
export type Match = { state: State; actions: Action[]; startedAt: number; computers: number }

/** A saved match is its seed, settings and action list; loading replays them, so a damaged save is rejected rather than trusted. */
export function loadMatch(seed?: string): Match | null {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!data || !Number.isInteger(data.count) || data.count < MIN_PLAYERS || data.count > MAX_PLAYERS || !isTurnsEach(data.turnsEach) || typeof data.seed !== 'string' ||
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
