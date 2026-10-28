import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, recordPlay, toggleFavorite } from './db'

beforeEach(async () => {
  await Promise.all([db.progress.clear(), db.favorites.clear(), db.history.clear()])
})

describe('recordPlay', () => {
  it('tracks plays and keeps the best score', async () => {
    await recordPlay('neon-merge', { score: 300, durationMs: 1000, won: false })
    await recordPlay('neon-merge', { score: 120 })
    const progress = await db.progress.get('neon-merge')
    expect(progress).toMatchObject({ gameId: 'neon-merge', highScore: 300, plays: 2 })
  })

  it('appends one history row per run', async () => {
    await recordPlay('pulse-tap', { score: 500, durationMs: 30000 })
    await recordPlay('memory-grid', { score: 900, won: true })
    expect(await db.history.count()).toBe(2)
    const [row] = await db.history.where('gameId').equals('memory-grid').toArray()
    expect(row).toMatchObject({ score: 900, won: true })
    expect(row.playedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('toggleFavorite', () => {
  it('adds then removes a favorite', async () => {
    await toggleFavorite('pulse-tap')
    expect(await db.favorites.get('pulse-tap')).toBeDefined()
    await toggleFavorite('pulse-tap')
    expect(await db.favorites.get('pulse-tap')).toBeUndefined()
  })
})

describe('daily runs', () => {
  it('stores the daily day key on the history row only when given', async () => {
    await recordPlay('twofold', { score: 900, won: true }, '2026-10-28')
    await recordPlay('twofold', { score: 800, won: true })
    const rows = await db.history.orderBy('id').toArray()
    expect(rows[0].daily).toBe('2026-10-28')
    expect('daily' in rows[1]).toBe(false)
  })
})
