import Dexie, { type EntityTable } from 'dexie'
import type { GameId, GameProgress, GameResult, PlayRecord } from '../types'
import { makeBackup, mergeBackup, type Backup } from './backup'

type Favorite = { gameId: GameId; addedAt: string }

class ArcadeDB extends Dexie {
  progress!: EntityTable<GameProgress, 'gameId'>
  favorites!: EntityTable<Favorite, 'gameId'>
  history!: EntityTable<PlayRecord, 'id'>

  constructor() {
    super('govibearcadia')
    this.version(1).stores({ progress: 'gameId,lastPlayed', favorites: 'gameId,addedAt' })
    // v2 adds a per-run history log (foundation for stats, XP, streaks and achievements).
    this.version(2).stores({ history: '++id,gameId,playedAt' })
  }
}

export const db = new ArcadeDB()

/** `daily` is the UTC day key when this run was that day's daily challenge. */
export async function recordPlay(gameId: GameId, result: GameResult, daily?: string): Promise<void> {
  const playedAt = new Date().toISOString()
  await db.transaction('rw', db.progress, db.history, async () => {
    const current = await db.progress.get(gameId)
    await db.progress.put({
      gameId,
      highScore: Math.max(result.score, current?.highScore ?? 0),
      plays: (current?.plays ?? 0) + 1,
      lastPlayed: playedAt,
    })
    await db.history.add({
      gameId,
      score: result.score,
      durationMs: result.durationMs,
      won: result.won,
      playedAt,
      ...(daily ? { daily } : {}),
    })
  })
}

export async function toggleFavorite(gameId: GameId): Promise<void> {
  const found = await db.favorites.get(gameId)
  if (found) await db.favorites.delete(gameId)
  else await db.favorites.put({ gameId, addedAt: new Date().toISOString() })
}

/** Everything stored on this device, ready to be written to a backup file. */
export async function exportAll(): Promise<Backup> {
  const [progress, favorites, history] = await Promise.all([db.progress.toArray(), db.favorites.toArray(), db.history.toArray()])
  return makeBackup({ progress, favorites, history })
}

/** Merges a validated backup into the database in one transaction. Returns how many new runs were added. */
export async function importBackup(backup: Backup): Promise<number> {
  return db.transaction('rw', db.progress, db.favorites, db.history, async () => {
    const [progress, favorites, history] = await Promise.all([db.progress.toArray(), db.favorites.toArray(), db.history.toArray()])
    const merged = mergeBackup({ progress, favorites, history }, backup)
    await db.progress.bulkPut(merged.progress)
    await db.favorites.bulkPut(merged.favorites)
    await db.history.bulkAdd(merged.newHistory)
    return merged.newHistory.length
  })
}
