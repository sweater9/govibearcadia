import { DEFAULT_CONFIG, type Config } from './rules'

/** The rules a player can choose before a match. Every one is a field of `Config`, so the engine needs no other change. */
export const SEED_OPTIONS = [4, 5, 6] as const
export const SOWING_OPTIONS = [1, 2, 3] as const

const SEEDS_NOTE: Record<number, string> = { 4: 'north Karnataka', 5: 'Mysore and the coast (default)', 6: 'Tamil Nadu and Andhra' }
export const seedsNote = (n: number) => SEEDS_NOTE[n] ?? ''

/** Clamp anything loaded from storage to a rule set the engine supports. */
export function normaliseConfig(raw: unknown): Config {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Partial<Config>
  return {
    seedsPerPit: (SEED_OPTIONS as readonly number[]).includes(c.seedsPerPit as number) ? (c.seedsPerPit as number) : DEFAULT_CONFIG.seedsPerPit,
    maxSowings: (SOWING_OPTIONS as readonly number[]).includes(c.maxSowings as number) ? (c.maxSowings as number) : DEFAULT_CONFIG.maxSowings,
    zeroCaptureGrantsSecond: typeof c.zeroCaptureGrantsSecond === 'boolean' ? c.zeroCaptureGrantsSecond : DEFAULT_CONFIG.zeroCaptureGrantsSecond,
    stranded: c.stranded === 'pass' ? 'pass' : 'owner-keeps',
    match: c.match === 'single' ? 'single' : 'match',
  }
}

export const isDefaultConfig = (c: Config) => (Object.keys(DEFAULT_CONFIG) as (keyof Config)[]).every((k) => c[k] === DEFAULT_CONFIG[k])

/** One plain sentence per rule, for the rules panel and for anyone joining a match in progress. */
export function describeConfig(c: Config): string[] {
  return [
    `${c.seedsPerPit} seeds in each pit (${c.seedsPerPit * 14} in all)`,
    c.maxSowings === 1 ? 'One sowing a turn: a capture does not earn another' : `Up to ${c.maxSowings} sowings a turn: each capture earns another`,
    c.zeroCaptureGrantsSecond ? 'A Saada that captures nothing still earns the next sowing' : 'A Saada must capture at least one seed to earn the next sowing',
    c.stranded === 'owner-keeps' ? 'When a player has no seeds to sow the round ends and leftover seeds go to the owner of their row' : 'When a player has no seeds to sow they pass and the other keeps sowing',
    c.match === 'match' ? 'A match: rounds with refills until a player cannot fill a pit' : 'A single round: the larger tray wins',
  ]
}
