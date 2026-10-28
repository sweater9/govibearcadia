/** Export/import of local progress. Pure: validation and merging only, no browser APIs. */
import type { GameProgress, PlayRecord } from '../types'

export type Favorite = { gameId: string; addedAt: string }
export type Backup = {
  app: 'govibearcadia'
  version: 1
  exportedAt: string
  progress: GameProgress[]
  favorites: Favorite[]
  history: Omit<PlayRecord, 'id'>[]
}

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024
const MAX_ROWS = 200_000

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 200
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isoish = (v: unknown): v is string => str(v) && !Number.isNaN(Date.parse(v))

export function makeBackup(data: Pick<Backup, 'progress' | 'favorites' | 'history'>, now = new Date()): Backup {
  return {
    app: 'govibearcadia',
    version: 1,
    exportedAt: now.toISOString(),
    progress: data.progress,
    favorites: data.favorites,
    history: data.history.map((r) => {
      const rest: Omit<PlayRecord, 'id'> & { id?: number } = { ...r }
      delete rest.id
      return rest
    }),
  }
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string }

/** Parses and strictly validates a backup file. Unknown fields are dropped; any malformed row rejects the whole file. */
export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: 'That file is too large to be a GoVibeArcadia backup.' }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  if (!isObj(raw) || raw.app !== 'govibearcadia') return { ok: false, error: 'That file is not a GoVibeArcadia backup.' }
  if (raw.version !== 1) return { ok: false, error: 'This backup was made by a newer version of the arcade and cannot be read.' }
  const { progress, favorites, history } = raw
  if (!Array.isArray(progress) || !Array.isArray(favorites) || !Array.isArray(history)) return { ok: false, error: 'The backup is missing data.' }
  if (progress.length + favorites.length + history.length > MAX_ROWS) return { ok: false, error: 'The backup has too many rows.' }

  const out: Backup = { app: 'govibearcadia', version: 1, exportedAt: isoish(raw.exportedAt) ? raw.exportedAt : new Date(0).toISOString(), progress: [], favorites: [], history: [] }
  for (const p of progress) {
    if (!isObj(p) || !str(p.gameId) || !num(p.highScore) || !num(p.plays) || p.plays < 0 || !isoish(p.lastPlayed)) return { ok: false, error: 'The backup contains a damaged progress row.' }
    out.progress.push({ gameId: p.gameId, highScore: p.highScore, plays: Math.floor(p.plays), lastPlayed: p.lastPlayed })
  }
  for (const f of favorites) {
    if (!isObj(f) || !str(f.gameId) || !isoish(f.addedAt)) return { ok: false, error: 'The backup contains a damaged favorite.' }
    out.favorites.push({ gameId: f.gameId, addedAt: f.addedAt })
  }
  for (const h of history) {
    if (!isObj(h) || !str(h.gameId) || !num(h.score) || !isoish(h.playedAt)) return { ok: false, error: 'The backup contains a damaged history row.' }
    if (h.durationMs !== undefined && !num(h.durationMs)) return { ok: false, error: 'The backup contains a damaged history row.' }
    if (h.won !== undefined && typeof h.won !== 'boolean') return { ok: false, error: 'The backup contains a damaged history row.' }
    if (h.daily !== undefined && !(str(h.daily) && /^\d{4}-\d{2}-\d{2}$/.test(h.daily))) return { ok: false, error: 'The backup contains a damaged history row.' }
    out.history.push({
      gameId: h.gameId,
      score: h.score,
      playedAt: h.playedAt,
      ...(h.durationMs !== undefined ? { durationMs: h.durationMs as number } : {}),
      ...(h.won !== undefined ? { won: h.won as boolean } : {}),
      ...(h.daily !== undefined ? { daily: h.daily as string } : {}),
    })
  }
  return { ok: true, backup: out }
}

export const historyKey = (r: Pick<PlayRecord, 'gameId' | 'playedAt' | 'score'>) => `${r.gameId}|${r.playedAt}|${r.score}`

/** Merges an imported backup into what is already stored. Nothing is ever lost or double counted. */
export function mergeBackup(
  current: Pick<Backup, 'progress' | 'favorites' | 'history'>,
  incoming: Pick<Backup, 'progress' | 'favorites' | 'history'>,
) {
  const seen = new Set(current.history.map(historyKey))
  const newHistory = incoming.history.filter((r) => {
    const k = historyKey(r)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  const progress = new Map(current.progress.map((p) => [p.gameId, p]))
  for (const p of incoming.progress) {
    const own = progress.get(p.gameId)
    progress.set(
      p.gameId,
      own
        ? { gameId: p.gameId, highScore: Math.max(own.highScore, p.highScore), plays: Math.max(own.plays, p.plays), lastPlayed: own.lastPlayed > p.lastPlayed ? own.lastPlayed : p.lastPlayed }
        : p,
    )
  }
  const favorites = new Map(current.favorites.map((f) => [f.gameId, f]))
  for (const f of incoming.favorites) if (!favorites.has(f.gameId)) favorites.set(f.gameId, f)

  return { progress: [...progress.values()], favorites: [...favorites.values()], newHistory }
}
