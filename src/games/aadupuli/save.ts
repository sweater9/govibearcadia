import { DEFAULT_CONFIG, isState, normaliseConfig, type Config, type Side, type State } from './rules'

export type Mode = 'computer' | 'local'
export type Saved = { v: 1; mode: Mode; human: Side; state: State; history: State[] }
const KEY = 'govibearcadia.aadu-puli-attam'

export function loadSaved(): Saved | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Saved | null
    if (value) { // saves from before rule choices have no config: they were standard
      value.state = { ...value.state, config: normaliseConfig(value.state?.config) }
      if (Array.isArray(value.history)) value.history = value.history.map((h) => ({ ...h, config: normaliseConfig(h?.config) }))
    }
    if (!value || value.v !== 1 || !['computer', 'local'].includes(value.mode) || !['goats', 'tigers'].includes(value.human) || !isState(value.state) || value.state.winner) return null
    return { ...value, history: Array.isArray(value.history) ? value.history.filter(isState) : [] }
  } catch { return null }
}

export function save(value: Saved) { try { localStorage.setItem(KEY, JSON.stringify(value)) } catch { /* play continues when storage is unavailable */ } }
export function clearSaved() { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }

const RULES_KEY = 'govibearcadia.aadu-puli-attam.rules'
export function loadRules(): Config {
  try { return normaliseConfig(JSON.parse(localStorage.getItem(RULES_KEY) ?? 'null')) } catch { return DEFAULT_CONFIG }
}
export function saveRules(c: Config) { try { localStorage.setItem(RULES_KEY, JSON.stringify(c)) } catch { /* ignore */ } }
