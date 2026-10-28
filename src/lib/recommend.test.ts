import { describe, expect, it } from 'vitest'
import type { PlayRecord } from '../types'
import { recommend } from './recommend'

const games = [
  { id: 'neon-merge', category: 'Numbers' },
  { id: 'memory-grid', category: 'Brain' },
  { id: 'minesweeper', category: 'Logic' },
  { id: 'twofold', category: 'Logic' },
  { id: 'carve', category: 'Logic' },
  { id: 'neon-snake', category: 'Retro' },
]
const NOW = new Date('2026-10-28T12:00:00Z')
const run = (gameId: string, extra: Partial<PlayRecord> = {}, day = '2026-10-27'): PlayRecord => ({ gameId, score: 1, playedAt: `${day}T10:00:00.000Z`, ...extra })

describe('recommend', () => {
  it('suggests friendly starters when there is no history', () => {
    expect(recommend(games, [], [], NOW)).toEqual([
      { gameId: 'neon-merge', reason: 'Easy to pick up' },
      { gameId: 'memory-grid', reason: 'Easy to pick up' },
      { gameId: 'minesweeper', reason: 'Easy to pick up' },
    ])
    expect(recommend([{ id: 'zeta', category: 'x' }, { id: 'alpha', category: 'x' }], [], [], NOW).map((r) => r.gameId)).toEqual(['alpha', 'zeta'])
  })

  it('prefers unplayed games in the category you play most', () => {
    const history = Array.from({ length: 6 }, () => run('carve', { won: true }))
    const recs = recommend(games, history, [], NOW)
    expect(recs[0].reason).toBe('You play a lot of Logic')
    expect(['minesweeper', 'twofold']).toContain(recs[0].gameId)
    expect(recs.map((r) => r.gameId)).not.toContain('carve')
    expect(recs).toHaveLength(3)
  })

  it('nudges you to retry a game you keep losing', () => {
    const history = [run('neon-snake'), run('neon-snake'), run('neon-snake'), run('carve', { won: true })]
    const recs = recommend(games, history, [], NOW)
    expect(recs.find((r) => r.gameId === 'neon-snake')).toEqual({ gameId: 'neon-snake', reason: '3 tries and no win yet' })
  })

  it('reminds you of a favorite you have not played for over a week, but not a recent one', () => {
    const stale = [run('twofold', { won: true }, '2026-10-01'), run('carve', { won: true })]
    expect(recommend(games, stale, ['twofold'], NOW).find((r) => r.gameId === 'twofold')?.reason).toBe('One of your favorites')
    const fresh = [run('twofold', { won: true }, '2026-10-27'), run('carve', { won: true })]
    expect(recommend(games, fresh, ['twofold'], NOW, 6).find((r) => r.gameId === 'twofold')?.reason).toBe('Beat your best')
  })

  it('lists each game at most once, never more than the limit, and is deterministic', () => {
    const history = [run('twofold', { won: true }), run('carve'), run('carve')]
    const a = recommend(games, history, ['carve', 'twofold'], NOW, 4)
    expect(a).toEqual(recommend(games, history, ['carve', 'twofold'], NOW, 4))
    expect(new Set(a.map((r) => r.gameId)).size).toBe(a.length)
    expect(a.length).toBeLessThanOrEqual(4)
    expect(recommend(games, history, [], NOW, 1)).toHaveLength(1)
  })

  it('returns nothing extra when every game was just won', () => {
    const history = games.map((g) => run(g.id, { won: true }))
    expect(recommend(games, history, [], NOW).every((r) => r.reason === 'Beat your best')).toBe(true)
  })
})
