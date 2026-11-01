import type { Level } from './ai'
import { PITS, type State } from './rules'

export type Mode = 'local' | 'computer'

/** A match in progress, kept only in this browser. */
export type Saved = { v: 1; mode: Mode; level: Level; state: State; history: State[] }

const KEY = 'govibearcadia.pallanguzhi'
export const SETTINGS_KEY = 'govibearcadia.pallanguzhi.settings'

export type Speed = 'slow' | 'normal' | 'fast' | 'instant'
export type Settings = { speed: Speed; sound: boolean; contrast: boolean; reduceMotion: boolean }
export const DEFAULT_SETTINGS: Settings = { speed: 'normal', sound: false, contrast: false, reduceMotion: false }

function validState(s: unknown): s is State {
  const x = s as State
  return (
    !!x && Array.isArray(x.pits) && x.pits.length === PITS && Array.isArray(x.active) && x.active.length === PITS &&
    Array.isArray(x.stores) && x.stores.length === 2 && !!x.config && (x.turn === 0 || x.turn === 1) && ['play', 'round-over', 'over'].includes(x.phase)
  )
}

export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Saved
    if (s?.v !== 1 || !['local', 'computer'].includes(s.mode) || !['easy', 'medium', 'hard'].includes(s.level) || !validState(s.state) || s.state.phase === 'over') return null
    s.history = Array.isArray(s.history) ? s.history.filter(validState) : []
    return s
  } catch {
    return null
  }
}

export function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode or full storage: the match still plays, it just will not resume */
  }
}

export function clearSaved() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const s = raw ? (JSON.parse(raw) as Partial<Settings>) : {}
    return {
      speed: ['slow', 'normal', 'fast', 'instant'].includes(s.speed as string) ? (s.speed as Speed) : DEFAULT_SETTINGS.speed,
      sound: s.sound === true, contrast: s.contrast === true, reduceMotion: s.reduceMotion === true,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* ignore */
  }
}
