import { describe, expect, it } from 'vitest'
import { makeBackup, mergeBackup, parseBackup } from './backup'

const run = { gameId: 'twofold', score: 900, playedAt: '2026-10-28T10:00:00.000Z', won: true, durationMs: 40000, daily: '2026-10-28' }
const data = {
  progress: [{ gameId: 'twofold', highScore: 900, plays: 3, lastPlayed: '2026-10-28T10:00:00.000Z' }],
  favorites: [{ gameId: 'carve', addedAt: '2026-10-27T10:00:00.000Z' }],
  history: [{ id: 7, ...run }],
}
const text = (b: unknown) => JSON.stringify(b)

describe('backup file', () => {
  it('round-trips and drops database ids', () => {
    const backup = makeBackup(data, new Date('2026-10-28T12:00:00Z'))
    expect(backup.history[0]).not.toHaveProperty('id')
    const parsed = parseBackup(text(backup))
    expect(parsed).toEqual({ ok: true, backup })
  })

  it('rejects things that are not backups', () => {
    for (const bad of ['', 'nope', '[]', '{}', text({ app: 'other', version: 1 }), text({ app: 'govibearcadia', version: 2 })]) expect(parseBackup(bad).ok).toBe(false)
    expect(parseBackup(text({ app: 'govibearcadia', version: 1, progress: [], favorites: [] }))).toMatchObject({ ok: false })
  })

  it('rejects the whole file when any row is damaged', () => {
    const base = makeBackup(data)
    const damaged = [
      { ...base, history: [{ ...run, score: 'high' }] },
      { ...base, history: [{ ...run, playedAt: 'yesterday' }] },
      { ...base, history: [{ ...run, daily: 'today' }] },
      { ...base, history: [{ ...run, won: 'yes' }] },
      { ...base, progress: [{ ...data.progress[0], plays: -1 }] },
      { ...base, favorites: [{ gameId: '', addedAt: run.playedAt }] },
    ]
    for (const b of damaged) expect(parseBackup(text(b)).ok).toBe(false)
  })

  it('drops unknown fields so nothing unexpected reaches the database', () => {
    const b = makeBackup(data)
    const dirty = { ...b, history: [{ ...b.history[0], evil: '<script>', __proto__: { x: 1 } }] }
    const r = parseBackup(text(dirty))
    expect(r.ok && r.backup.history[0]).not.toHaveProperty('evil')
  })

  it('rejects oversized input', () => {
    expect(parseBackup(' '.repeat(21 * 1024 * 1024)).ok).toBe(false)
  })
})

describe('merging', () => {
  it('adds only new runs, never double counts, and keeps the better progress', () => {
    const current = { progress: data.progress, favorites: [], history: [run] }
    const incoming = {
      progress: [{ gameId: 'twofold', highScore: 950, plays: 2, lastPlayed: '2026-10-29T00:00:00.000Z' }, { gameId: 'carve', highScore: 5, plays: 1, lastPlayed: '2026-10-01T00:00:00.000Z' }],
      favorites: data.favorites,
      history: [run, { ...run, playedAt: '2026-10-29T00:00:00.000Z' }],
    }
    const merged = mergeBackup(current, incoming)
    expect(merged.newHistory).toHaveLength(1)
    expect(merged.progress.find((p) => p.gameId === 'twofold')).toEqual({ gameId: 'twofold', highScore: 950, plays: 3, lastPlayed: '2026-10-29T00:00:00.000Z' })
    expect(merged.progress).toHaveLength(2)
    expect(merged.favorites).toHaveLength(1)
    // Importing the same file again changes nothing.
    expect(mergeBackup({ ...merged, history: [run, ...merged.newHistory] }, incoming).newHistory).toHaveLength(0)
  })
})
