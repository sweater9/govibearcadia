import { createRandom } from '../../lib/rng'
import { generate, isSolvable, newState, type Config, type Level, type MState } from './rules'

export const CAMPAIGN_LEVELS = 50
export type Difficulty = 'easy' | 'normal' | 'hard'
export const DIFFICULTIES: Record<Difficulty, { label: string; hearts: number; time: number; enemy: number }> = {
  easy: { label: 'Easy: 4 hearts, more time, slower enemies', hearts: 4, time: 1.3, enemy: 1.25 },
  normal: { label: 'Normal: 3 hearts', hearts: 3, time: 1, enemy: 1 },
  hard: { label: 'Hard: 2 hearts, less time, faster enemies', hearts: 2, time: 0.8, enemy: 0.8 },
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * What each campaign level adds, in order:
 * 1 a plain maze; 2 coins; 4 spikes; 6 locked doors and keys; 9 an enemy; 10 a countdown; 11 power-ups;
 * 16 fog on even levels; 20 spikes that come and go. Mazes grow from 7x7 (level 1) to 21x21 (level 50).
 */
export function campaignConfig(n: number): Config {
  const size = Math.min(21, 7 + 2 * Math.floor((n - 1) / 7))
  return {
    w: size,
    h: size,
    braid: n < 3 ? 0.04 : clamp(0.04 + n * 0.002, 0.04, 0.12),
    coins: n < 2 ? 0 : clamp(2 + Math.floor(n / 3), 3, 14),
    traps: n < 4 ? 0 : clamp(1 + Math.floor((n - 4) / 3), 1, 12),
    togglingTraps: n >= 20,
    doors: n < 6 ? 0 : clamp(1 + Math.floor((n - 6) / 11), 1, 4),
    enemies: n < 9 ? 0 : clamp(1 + Math.floor((n - 9) / 9), 1, 5),
    enemyMs: Math.round(clamp(800 - (n - 9) * 9, 380, 800)),
    powers: n < 11 ? 0 : clamp(1 + Math.floor((n - 11) / 9), 1, 5),
    timed: n === 10 ? 4 : n >= 13 && n % 3 !== 0 ? clamp(3.6 - (n - 13) * 0.025, 2.4, 3.6) : 0,
    fog: n >= 16 && n % 2 === 0 ? clamp(6 - Math.floor((n - 16) / 8), 3, 6) : 0,
  }
}

export const campaignSeed = (n: number) => `maze-campaign-${n}`

export function campaignLevel(n: number): Level {
  if (!Number.isInteger(n) || n < 1 || n > CAMPAIGN_LEVELS) throw new Error(`Level ${n} does not exist`)
  const level = generate(campaignConfig(n), createRandom(campaignSeed(n)))
  if (!isSolvable(level)) throw new Error(`Level ${n} is not solvable`)
  return level
}

/** Which new thing level n introduces (shown on the level card), or null. */
export function introduces(n: number): string | null {
  return ({ 1: 'A plain maze. Find the exit.', 2: 'Coins', 4: 'Spikes', 6: 'Locked doors and keys', 9: 'An enemy that walks the maze', 10: 'A countdown', 11: 'Power-ups', 16: 'Fog: you only see nearby', 20: 'Spikes that come and go' } as Record<number, string>)[n] ?? null
}

/** Endless mode: maze number `i` (from 0) of a run. Grows and adds hazards as the run goes on. */
export function endlessConfig(i: number): Config {
  const size = Math.min(21, 7 + 2 * Math.floor(i / 2))
  return {
    w: size,
    h: size,
    braid: clamp(0.04 + i * 0.004, 0.04, 0.14),
    coins: clamp(3 + Math.floor(i / 2), 3, 12),
    traps: i < 1 ? 0 : clamp(Math.floor(i * 0.8), 1, 12),
    togglingTraps: i >= 8,
    doors: i < 3 ? 0 : clamp(1 + Math.floor((i - 3) / 4), 1, 4),
    enemies: i < 4 ? 0 : clamp(1 + Math.floor((i - 4) / 4), 1, 5),
    enemyMs: Math.round(clamp(750 - i * 20, 360, 750)),
    powers: clamp(1 + Math.floor(i / 5), 1, 4),
    timed: clamp(4 - i * 0.12, 2.4, 4),
    fog: i >= 6 && i % 3 === 0 ? clamp(6 - Math.floor((i - 6) / 6), 3, 6) : 0,
  }
}

export const endlessSeed = (runSeed: string, i: number) => `${runSeed}:maze:${i}`
export const endlessLevel = (runSeed: string, i: number): Level => generate(endlessConfig(i), createRandom(endlessSeed(runSeed, i)))

/** Applies the difficulty setting (hearts, time and enemy speed) without changing the maze itself. */
export function startLevel(level: Level, d: Difficulty, hearts?: number): MState {
  const k = DIFFICULTIES[d]
  return newState({ ...level, enemyMs: Math.round(level.enemyMs * k.enemy) }, hearts ?? k.hearts, k.time)
}
