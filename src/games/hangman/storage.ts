/** Hangman's small local record: best streak, words solved, and today's daily result. Stays on this device. */
const KEY = 'govibearcadia.hangman'
export type DailyRecord = { day: string; won: boolean; word: string }
export type HangmanStats = { bestStreak: number; solved: number; played: number; daily: DailyRecord | null }
export const EMPTY_STATS: HangmanStats = { bestStreak: 0, solved: 0, played: 0, daily: null }

export function readStats(): HangmanStats {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY_STATS
    const v = JSON.parse(raw) as Partial<HangmanStats>
    const d = v.daily
    return {
      bestStreak: Number.isFinite(v.bestStreak) ? Number(v.bestStreak) : 0,
      solved: Number.isFinite(v.solved) ? Number(v.solved) : 0,
      played: Number.isFinite(v.played) ? Number(v.played) : 0,
      daily: d && typeof d.day === 'string' && typeof d.word === 'string' ? { day: d.day, won: !!d.won, word: d.word } : null,
    }
  } catch {
    return EMPTY_STATS
  }
}

export function writeStats(s: HangmanStats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode: stats are just not remembered */
  }
}
