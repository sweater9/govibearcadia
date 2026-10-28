/** Stable identifier for a game. The registry in `src/games/registry.ts` is the single source of truth. */
export type GameId = string

export type GameMeta = {
  id: GameId
  title: string
  description: string
  category: string
  accent: string
  glyph: string
  estimated: string
  /** Eligible for the daily challenge: seeded, solvable, and reports `won`. */
  daily?: boolean
}

/**
 * What a game reports when a run ends. Phase 2 features (XP, achievements, records,
 * daily challenges) are computed locally from these fields, so games report more than a score.
 */
export type GameResult = {
  score: number
  durationMs?: number
  won?: boolean
  /** Game-specific numbers, e.g. `{ moves: 14 }`. */
  stats?: Record<string, number>
}

/** Props every game component receives. */
export type GameProps = {
  /** Called exactly once per finished (or abandoned-with-progress) run. */
  onFinish: (result: GameResult) => void
  /** When set, all randomness is deterministic. Daily challenges will pass a date-derived seed. */
  seed?: string
}

export type GameProgress = { gameId: GameId; highScore: number; plays: number; lastPlayed: string }

export type PlayRecord = {
  id?: number
  gameId: GameId
  score: number
  durationMs?: number
  won?: boolean
  playedAt: string
  /** UTC day key (e.g. 2026-10-28) when the run was that day's daily challenge. */
  daily?: string
}
