import type { State } from './rules'

/** A game in progress, kept only in this browser. The dice come from `seed` and `draws`, so play continues the same way. */
export type Saved = { v: 1; seed: string; draws: number; humans: number; state: State; tokens?: number[] }

const KEY = 'govibearcadia.ghata'

export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Saved
    const state = s?.state
    if (s?.v !== 1 || typeof s.seed !== 'string' || !Number.isInteger(s.draws) || ![1, 2, 3, 4].includes(s.humans)) return null
    if (!state || state.pawns?.length !== 24 || !Array.isArray(state.jugas) || !Array.isArray(state.queue) || state.phase === 'over') return null
    if (state.size !== 5 && state.size !== 7) state.size = 5 // games saved before the 7x7 board existed
    return s
  } catch {
    return null
  }
}

export function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode or full storage: the game still works, it just won't resume */
  }
}

export function clearSaved() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

const TOKEN_KEY = 'govibearcadia.ghata.token'

/** The piece the first player picked last time, kept only on this device. */
export function loadTokenPref(): number | null {
  try {
    const n = Number(localStorage.getItem(TOKEN_KEY))
    return localStorage.getItem(TOKEN_KEY) !== null && Number.isInteger(n) ? n : null
  } catch {
    return null
  }
}

export function saveTokenPref(n: number) {
  try {
    localStorage.setItem(TOKEN_KEY, String(n))
  } catch {
    /* ignore */
  }
}
