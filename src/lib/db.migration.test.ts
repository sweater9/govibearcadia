import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it } from 'vitest'

it('upgrades an existing v1 database to v2 without losing player data', async () => {
  // Simulate a returning player whose browser still holds the original v1 schema.
  const legacy = new Dexie('govibearcadia')
  legacy.version(1).stores({ progress: 'gameId,lastPlayed', favorites: 'gameId,addedAt' })
  await legacy.table('progress').put({ gameId: 'neon-merge', highScore: 2048, plays: 7, lastPlayed: '2026-10-20T10:00:00.000Z' })
  await legacy.table('favorites').put({ gameId: 'pulse-tap', addedAt: '2026-10-21T10:00:00.000Z' })
  legacy.close()

  const { db, recordPlay } = await import('./db')
  expect(await db.progress.get('neon-merge')).toMatchObject({ highScore: 2048, plays: 7 })
  expect(await db.favorites.get('pulse-tap')).toBeDefined()

  await recordPlay('neon-merge', { score: 64 })
  expect(await db.history.count()).toBe(1)
  expect(await db.progress.get('neon-merge')).toMatchObject({ highScore: 2048, plays: 8 })
})
