import { createRandom } from '../../lib/rng'
import { generate, isSolvable, newState, type Config, type Level, type MState } from './rules'

export const CAMPAIGN_LEVELS = 50
export type Difficulty = 'practice' | 'easy' | 'normal' | 'hard'
export const DIFFICULTIES: Record<Difficulty, { label: string; hearts: number; time: number; enemy: number }> = {
  practice: { label: 'Practice: no chasers, learn the maze', hearts: 4, time: 1.5, enemy: 1 },
  easy: { label: 'Easy: 4 hearts, more time, slower enemies', hearts: 4, time: 1.3, enemy: 1.25 },
  normal: { label: 'Normal: 3 hearts', hearts: 3, time: 1, enemy: 1 },
  hard: { label: 'Hard: 2 hearts, less time, faster enemies', hearts: 2, time: 0.8, enemy: 0.8 },
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/**
 * Chase mode. Eat every pellet to clear the maze. Big pellets scare the chasers for a few seconds so you can catch
 * them. Mazes grow from 7x7 (level 1) to 21x21 (level 50); more and faster chasers arrive as you go, and the
 * mazes get more loops so you can run circles.
 */
export function campaignConfig(n: number): Config {
  const size = Math.min(21, 7 + 2 * Math.floor((n - 1) / 7))
  return {
    w: size,
    h: size,
    braid: clamp(0.12 + n * 0.004, 0.12, 0.32),
    coins: 0,
    traps: 0,
    togglingTraps: false,
    doors: 0,
    enemies: clamp(1 + Math.floor((n - 1) / 9), 1, 5),
    enemyMs: Math.round(clamp(1000 - n * 12, 400, 1000)),
    powers: 0,
    timed: 0,
    fog: 0,
    pellets: true,
    bigPellets: size >= 15 ? 4 : size >= 11 ? 3 : 2,
  }
}

export const campaignSeed = (n: number) => `maze-campaign-${n}`

export function campaignLevel(n: number): Level {
  if (!Number.isInteger(n) || n < 1 || n > CAMPAIGN_LEVELS) throw new Error(`Level ${n} does not exist`)
  const level = generate(campaignConfig(n), createRandom(campaignSeed(n)))
  if (!isSolvable(level)) throw new Error(`Level ${n} is not solvable`)
  return level
}

/** What level n adds, shown on the start hint. */
export function introduces(n: number): string | null {
  return ({ 1: 'Eat every pellet. One slow chaser patrols the maze; touching it costs a heart.', 2: 'Big pellets scare chasers. Catch them while they are blue.', 10: 'A second chaser joins.', 19: 'A third chaser joins.', 28: 'A fourth chaser joins.', 37: 'A fifth chaser joins.' } as Record<number, string>)[n] ?? null
}

/** Endless mode: maze number `i` (from 0) of a run. Grows and adds hazards as the run goes on. */
export function endlessConfig(i: number): Config {
  const size = Math.min(21, 7 + 2 * Math.floor(i / 2))
  return {
    w: size,
    h: size,
    braid: clamp(0.12 + i * 0.01, 0.12, 0.32),
    coins: 0,
    traps: 0,
    togglingTraps: false,
    doors: 0,
    enemies: clamp(1 + Math.floor(i / 3), 1, 5),
    enemyMs: Math.round(clamp(900 - i * 25, 380, 900)),
    powers: 0,
    timed: 0,
    fog: 0,
    pellets: true,
    bigPellets: size >= 15 ? 4 : size >= 11 ? 3 : 2,
  }
}

export const endlessSeed = (runSeed: string, i: number) => `${runSeed}:maze:${i}`
export const endlessLevel = (runSeed: string, i: number): Level => generate(endlessConfig(i), createRandom(endlessSeed(runSeed, i)))

/** Applies the difficulty setting (hearts, time and enemy speed) without changing the maze itself. */
export function startLevel(level: Level, d: Difficulty, hearts?: number): MState {
  const k = DIFFICULTIES[d]
  return newState({ ...level, enemies: d === 'practice' ? [] : level.enemies, enemyMs: Math.round(level.enemyMs * k.enemy) }, hearts ?? k.hearts, k.time)
}
