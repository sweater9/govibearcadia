import { LEVELS, type Level } from './ai'
import { LIVE_RESERVE, type State } from './rules'

export type Saved = { v: 1; level: Level; startedAt: number; state: State; seed: string }
const KEY = 'govibearcadia.mahjong'

export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Saved
    const x = s?.state
    if (s?.v !== 1 || !x || !LEVELS.includes(s.level) || typeof s.seed !== 'string') return null
    if (!Array.isArray(x.wall) || x.wall.length !== 144 || !Array.isArray(x.seats) || x.seats.length !== 4) return null
    if (!['discard', 'claim', 'hand-over'].includes(x.phase) || !(x.next >= 0 && x.next <= 144 - LIVE_RESERVE) || !(x.turn >= 0 && x.turn < 4)) return null
    if (!x.seats.every((p) => Array.isArray(p.hand) && Array.isArray(p.melds) && Array.isArray(p.flowers) && Array.isArray(p.discards))) return null
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
