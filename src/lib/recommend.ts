/** "What should I play next?" Local, deterministic and explainable: it only looks at this device's history and favorites. */
import type { GameId, GameMeta, PlayRecord } from '../types'

export type Recommendation = { gameId: GameId; reason: string }

/** Friendly first picks for someone with no history yet. */
export const STARTERS: readonly GameId[] = ['neon-merge', 'memory-grid', 'minesweeper']

const DAY_MS = 86_400_000

export function recommend(
  games: readonly Pick<GameMeta, 'id' | 'category'>[],
  history: readonly PlayRecord[],
  favorites: readonly GameId[],
  now: Date,
  limit = 3,
): Recommendation[] {
  if (history.length === 0) {
    const ids = new Set(games.map((g) => g.id))
    const picks = [...STARTERS.filter((id) => ids.has(id)), ...games.map((g) => g.id).sort()]
    return [...new Set(picks)].slice(0, limit).map((gameId) => ({ gameId, reason: 'Easy to pick up' }))
  }

  const stats = new Map<GameId, { plays: number; wins: number; last: number }>()
  const byCategory = new Map<string, number>()
  const categoryOf = new Map(games.map((g) => [g.id, g.category]))
  for (const r of history) {
    const s = stats.get(r.gameId) ?? { plays: 0, wins: 0, last: 0 }
    s.plays++
    if (r.won) s.wins++
    s.last = Math.max(s.last, Date.parse(r.playedAt))
    stats.set(r.gameId, s)
    const cat = categoryOf.get(r.gameId)
    if (cat) byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1)
  }

  const scored: { gameId: GameId; score: number; reason: string }[] = []
  for (const g of games) {
    const s = stats.get(g.id)
    const cat = byCategory.get(g.category) ?? 0
    const options: { score: number; reason: string }[] = []
    if (!s) options.push(cat > 0 ? { score: 10 + Math.min(cat, 10), reason: `You play a lot of ${g.category}` } : { score: 6, reason: 'Something new to try' })
    if (s && s.wins === 0 && s.plays >= 2) options.push({ score: 8 + Math.min(s.plays, 5), reason: `${s.plays} tries and no win yet` })
    if (favorites.includes(g.id) && (!s || now.getTime() - s.last > 7 * DAY_MS)) options.push({ score: 9, reason: 'One of your favorites' })
    if (s && s.wins > 0) options.push({ score: 3 + Math.min((now.getTime() - s.last) / DAY_MS, 5), reason: 'Beat your best' })
    const best = options.sort((a, b) => b.score - a.score)[0]
    if (best) scored.push({ gameId: g.id, ...best })
  }
  return scored
    .sort((a, b) => b.score - a.score || a.gameId.localeCompare(b.gameId))
    .slice(0, limit)
    .map(({ gameId, reason }) => ({ gameId, reason }))
}
