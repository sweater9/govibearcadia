import type { GameProgress } from '../types'

/**
 * Personal bests come from the `progress` row every run already updates (`highScore`), so no schema change is needed.
 * Pure: no React or browser APIs.
 */
export type BestUpdate = { best: number; isNew: boolean }

/** What a finished run does to a game's best. A first-ever run sets the best but is not announced as a "new best". */
export function bestAfter(previous: Pick<GameProgress, 'highScore' | 'plays'> | undefined, score: number): BestUpdate {
  const before = previous?.highScore ?? 0
  const played = (previous?.plays ?? 0) > 0
  return { best: Math.max(before, score), isNew: played && score > before }
}
