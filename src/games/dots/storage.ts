/** Dots and Boxes' small local record: results by level and the last few games. Stays on this device. */
const KEY = 'govibearcadia.dots'
export type Entry = { day: string; size: string; level: string; you: number; them: number; result: 'win' | 'loss' | 'draw' }
export type DotsStats = { played: number; wins: number; losses: number; draws: number; history: Entry[] }
export const EMPTY_STATS: DotsStats = { played: 0, wins: 0, losses: 0, draws: 0, history: [] }
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function readStats(): DotsStats {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY_STATS
    const v = JSON.parse(raw) as Partial<DotsStats>
    const history = Array.isArray(v.history)
      ? v.history.filter((h): h is Entry => !!h && typeof h.size === 'string' && typeof h.level === 'string' && ['win', 'loss', 'draw'].includes(h.result)).slice(-10)
      : []
    return { played: num(v.played), wins: num(v.wins), losses: num(v.losses), draws: num(v.draws), history }
  } catch {
    return EMPTY_STATS
  }
}

export function writeStats(s: DotsStats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode: stats are just not remembered */
  }
}

export function record(s: DotsStats, e: Entry): DotsStats {
  return {
    played: s.played + 1,
    wins: s.wins + (e.result === 'win' ? 1 : 0),
    losses: s.losses + (e.result === 'loss' ? 1 : 0),
    draws: s.draws + (e.result === 'draw' ? 1 : 0),
    history: [...s.history, e].slice(-10),
  }
}
