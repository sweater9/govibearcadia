import { isState, type Side, type State } from './rules'

export type Mode = 'computer' | 'local'
export type Saved = { v: 1; mode: Mode; human: Side; state: State; history: State[] }
const KEY = 'govibearcadia.aadu-puli-attam'

export function loadSaved(): Saved | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null
    if (!value || value.v !== 1 || !['computer', 'local'].includes(value.mode) || !['goats', 'tigers'].includes(value.human) || !isState(value.state) || value.state.winner) return null
    return { ...value, history: Array.isArray(value.history) ? value.history.filter(isState) : [] }
  } catch { return null }
}

export function save(value: Saved) { try { localStorage.setItem(KEY, JSON.stringify(value)) } catch { /* play continues when storage is unavailable */ } }
export function clearSaved() { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }
