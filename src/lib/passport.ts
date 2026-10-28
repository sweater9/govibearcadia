/**
 * Arcadia Passport: everything the player earns, computed locally from the run history. Pure functions, no
 * browser APIs, so the numbers can be tested exactly and rebuilt from history at any time.
 */
import { dailySeed, hashSeed } from './rng'
import type { GameId, PlayRecord } from '../types'

// ---- XP and levels -------------------------------------------------------------------------------

export const XP_PER_PLAY = 10
export const XP_WIN_BONUS = 15
export const XP_DAILY_BONUS = 50

/** XP for one run: 10 for playing, +15 for a win, +50 more for winning that day's challenge. */
export function xpFor(record: Pick<PlayRecord, 'won' | 'daily'>): number {
  return XP_PER_PLAY + (record.won ? XP_WIN_BONUS : 0) + (record.won && record.daily ? XP_DAILY_BONUS : 0)
}

/** Total XP needed to reach a level (level 1 is 0): 50 * (L-1) * L, so each level costs 100 more than the last. */
export const xpToReach = (level: number): number => 50 * (level - 1) * level

export type LevelInfo = { level: number; xp: number; into: number; span: number }

export function levelFor(xp: number): LevelInfo {
  let level = 1
  while (xpToReach(level + 1) <= xp) level++
  return { level, xp, into: xp - xpToReach(level), span: xpToReach(level + 1) - xpToReach(level) }
}

// ---- Daily challenge and streaks ----------------------------------------------------------------

export type DailyChallenge = { day: string; gameId: GameId; seed: string }

/** Same game and seed for every player on a given UTC day. `ids` must be in a stable order. */
export function dailyChallenge(day: string, ids: readonly GameId[]): DailyChallenge {
  const sorted = [...ids].sort()
  return { day, gameId: sorted[hashSeed(`daily:${day}`) % sorted.length], seed: day }
}

export const today = (now: Date = new Date()): string => dailySeed(now)

const shiftDay = (day: string, by: number): string => {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + by)
  return d.toISOString().slice(0, 10)
}

/** Consecutive-day streaks over the days a daily challenge was won. A streak stays alive until a whole day is missed. */
export function streaks(days: Iterable<string>, now: string): { current: number; best: number } {
  const set = new Set(days)
  let current = 0
  let at = set.has(now) ? now : shiftDay(now, -1)
  while (set.has(at)) {
    current++
    at = shiftDay(at, -1)
  }
  let best = 0
  for (const day of set) {
    if (set.has(shiftDay(day, -1))) continue // not the start of a run
    let n = 0
    for (let d = day; set.has(d); d = shiftDay(d, 1)) n++
    best = Math.max(best, n)
  }
  return { current, best }
}

// ---- Summary, records and achievements ------------------------------------------------------------

export type Summary = {
  plays: number
  wins: number
  gamesPlayed: number
  dailyWins: number
  xp: number
  level: number
  streak: { current: number; best: number }
}

export function summarise(history: readonly PlayRecord[], now: string): Summary {
  const dailyDays = new Set(history.filter((r) => r.won && r.daily).map((r) => r.daily as string))
  const xp = history.reduce((n, r) => n + xpFor(r), 0)
  return {
    plays: history.length,
    wins: history.filter((r) => r.won).length,
    gamesPlayed: new Set(history.map((r) => r.gameId)).size,
    dailyWins: dailyDays.size,
    xp,
    level: levelFor(xp).level,
    streak: streaks(dailyDays, now),
  }
}

export type Achievement = { id: string; title: string; description: string; earned: (s: Summary) => boolean }

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-play', title: 'Player One', description: 'Finish your first run.', earned: (s) => s.plays >= 1 },
  { id: 'first-win', title: 'First Win', description: 'Win a game.', earned: (s) => s.wins >= 1 },
  { id: 'ten-plays', title: 'Regular', description: 'Finish 10 runs.', earned: (s) => s.plays >= 10 },
  { id: 'hundred-plays', title: 'Arcade Rat', description: 'Finish 100 runs.', earned: (s) => s.plays >= 100 },
  { id: 'five-games', title: 'Sampler', description: 'Play 5 different games.', earned: (s) => s.gamesPlayed >= 5 },
  { id: 'ten-games', title: 'Explorer', description: 'Play 10 different games.', earned: (s) => s.gamesPlayed >= 10 },
  { id: 'daily-first', title: 'Daily Driver', description: 'Win a daily challenge.', earned: (s) => s.dailyWins >= 1 },
  { id: 'streak-3', title: 'On a Roll', description: 'Win the daily challenge 3 days in a row.', earned: (s) => s.streak.best >= 3 },
  { id: 'streak-7', title: 'Week Warrior', description: 'Win the daily challenge 7 days in a row.', earned: (s) => s.streak.best >= 7 },
  { id: 'level-5', title: 'Level 5', description: 'Reach level 5.', earned: (s) => s.level >= 5 },
]

export const earnedAchievements = (s: Summary): Achievement[] => ACHIEVEMENTS.filter((a) => a.earned(s))

/** Best score and fastest win for each game. */
export type GameRecord = { gameId: GameId; plays: number; wins: number; bestScore: number; bestTimeMs?: number }

export function recordsByGame(history: readonly PlayRecord[]): GameRecord[] {
  const out = new Map<GameId, GameRecord>()
  for (const r of history) {
    const cur = out.get(r.gameId) ?? { gameId: r.gameId, plays: 0, wins: 0, bestScore: 0 }
    cur.plays++
    if (r.won) {
      cur.wins++
      if (r.durationMs !== undefined && r.durationMs > 0) cur.bestTimeMs = Math.min(cur.bestTimeMs ?? Infinity, r.durationMs)
    }
    cur.bestScore = Math.max(cur.bestScore, r.score)
    out.set(r.gameId, cur)
  }
  return [...out.values()].sort((a, b) => b.plays - a.plays || a.gameId.localeCompare(b.gameId))
}
