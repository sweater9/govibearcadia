import type { Level } from './ai'
import type { State } from './rules'

export type Opponent = 'people' | 'computer'
export type Saved = { v: 1; opponent: Opponent; level: Level; startedAt: number; state: State }
const KEY = 'govibearcadia.carrom'

export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Saved
    const x = s?.state
    if (s?.v !== 1 || !x || !Array.isArray(x.coins) || x.coins.length !== 19 || x.phase === 'over' || !['people', 'computer'].includes(s.opponent) || !['easy', 'medium', 'hard'].includes(s.level)) return null
    if (![2, 4].includes(x.config?.players) || !(x.turn >= 0 && x.turn < x.config.players)) return null
    return s
  } catch {
    return null
  }
}
export function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode: playing still works */
  }
}
export function clearSaved() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
