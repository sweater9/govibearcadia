import type { GameId } from '../types'

/**
 * Levels for the score-chase games. A level is cleared by reaching its score target (or by winning outright),
 * and each level after the first plays faster. Level 1 is the game exactly as it was before levels existed.
 *
 * The targets are estimates, kept in this one table so they are easy to tune after real play.
 */
export const LEVEL_TARGETS: Record<GameId, { base: number; step: number; cap: number }> = {
  'pulse-tap': { base: 1500, step: 200, cap: 3500 },
  'brick-breaker': { base: 500, step: 50, cap: 1100 },
  'neon-pong': { base: 400, step: 50, cap: 700 },
  'neon-snake': { base: 100, step: 20, cap: 400 },
  'space-defender': { base: 600, step: 300, cap: 2700 },
  'asteroid-assault': { base: 1000, step: 500, cap: 8000 },
  'lane-hopper': { base: 15, step: 3, cap: 60 },
  'traffic-dodger': { base: 500, step: 100, cap: 3000 },
  'stack-tower': { base: 150, step: 30, cap: 600 },
  'mole-mash': { base: 200, step: 60, cap: 1200 },
}

export const isLeveled = (id: GameId): boolean => id in LEVEL_TARGETS

const whole = (n: number) => Math.max(1, Math.floor(n) || 1)

/** The score that clears a level. */
export function levelTarget(id: GameId, level: number): number {
  const t = LEVEL_TARGETS[id]
  if (!t) return 0
  return Math.min(t.cap, t.base + t.step * (whole(level) - 1))
}

/** How much faster than level 1 a level plays: 1 at level 1, up to 1.8. */
export const levelPace = (level: number): number => Math.min(1.8, 1 + 0.08 * (whole(level) - 1))

export const levelCleared = (id: GameId, level: number, result: { score: number; won?: boolean }): boolean =>
  !!result.won || result.score >= levelTarget(id, level)

const KEY = 'govibearcadia.levels'

/** The highest level cleared in each game, kept on this device only. */
export function readCleared(): Record<GameId, number> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as unknown
    return v && typeof v === 'object' ? (v as Record<GameId, number>) : {}
  } catch {
    return {}
  }
}

export function saveCleared(id: GameId, level: number): void {
  try {
    const all = readCleared()
    if ((all[id] ?? 0) >= level) return
    localStorage.setItem(KEY, JSON.stringify({ ...all, [id]: level }))
  } catch {
    // Storage can be blocked; levels then simply start from 1 each visit.
  }
}
