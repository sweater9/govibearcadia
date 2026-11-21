import { CAMPAIGN_LEVELS, type Difficulty } from './levels'

/** Maze Runner's progress, kept only in this browser (`localStorage`, key `govibearcadia.maze`). */
const KEY = 'govibearcadia.maze'
export type LevelRecord = { stars: number; bestMs: number; bestScore: number }
export type EndlessRun = { mazes: number; distance: number; timeMs: number; day: string }
export type MazeSave = {
  /** Highest campaign level you can play. */
  unlocked: number
  levels: Record<number, LevelRecord>
  coins: number
  endless: { top: EndlessRun[] }
  achievements: string[]
  settings: { difficulty: Difficulty; dpad: boolean }
}
export const EMPTY: MazeSave = { unlocked: 1, levels: {}, coins: 0, endless: { top: [] }, achievements: [], settings: { difficulty: 'normal', dpad: false } }

export const ACHIEVEMENTS: { id: string; title: string; how: string }[] = [
  { id: 'first-exit', title: 'First exit', how: 'Finish a campaign level.' },
  { id: 'untouched', title: 'Untouched', how: 'Finish level 4 or later without losing a heart.' },
  { id: 'key-master', title: 'Key master', how: 'Finish a level that has two or more locked doors.' },
  { id: 'fog-walker', title: 'Fog walker', how: 'Finish a level with fog.' },
  { id: 'coin-hoarder', title: 'Coin hoarder', how: 'Collect 100 coins in total.' },
  { id: 'level-10', title: 'Ten down', how: 'Finish level 10.' },
  { id: 'level-25', title: 'Halfway', how: 'Finish level 25.' },
  { id: 'level-50', title: 'Maze master', how: 'Finish level 50.' },
  { id: 'star-collector', title: 'Star collector', how: 'Earn three stars on ten different levels.' },
  { id: 'endless-5', title: 'Five and counting', how: 'Clear 5 mazes in one Endless run.' },
  { id: 'endless-15', title: 'Marathon', how: 'Clear 15 mazes in one Endless run.' },
]

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

export function readSave(): MazeSave {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const v = JSON.parse(raw) as Partial<MazeSave>
    const levels: Record<number, LevelRecord> = {}
    for (const [k, r] of Object.entries(v.levels ?? {})) {
      const n = Number(k)
      if (Number.isInteger(n) && n >= 1 && n <= CAMPAIGN_LEVELS && r) levels[n] = { stars: Math.min(3, Math.max(0, num(r.stars))), bestMs: num(r.bestMs), bestScore: num(r.bestScore) }
    }
    const top = Array.isArray(v.endless?.top) ? v.endless.top.filter((r) => r && Number.isFinite(r.mazes)).map((r) => ({ mazes: num(r.mazes), distance: num(r.distance), timeMs: num(r.timeMs), day: typeof r.day === 'string' ? r.day : '' })).slice(0, 10) : []
    const d = v.settings?.difficulty
    return {
      unlocked: Math.min(CAMPAIGN_LEVELS, Math.max(1, num(v.unlocked, 1))),
      levels,
      coins: num(v.coins),
      endless: { top },
      achievements: Array.isArray(v.achievements) ? v.achievements.filter((a): a is string => typeof a === 'string') : [],
      settings: { difficulty: d === 'easy' || d === 'hard' ? d : 'normal', dpad: !!v.settings?.dpad },
    }
  } catch {
    return EMPTY
  }
}

export function writeSave(s: MazeSave) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode: progress is just not remembered */
  }
}

export type LevelResult = { n: number; stars: number; ms: number; score: number; coins: number; hits: number; doors: number; fog: boolean }

/** Folds a finished campaign level into the save: best stars/time/score, unlocks the next level, achievements. */
export function recordLevel(s: MazeSave, r: LevelResult): { save: MazeSave; earned: string[] } {
  const prev = s.levels[r.n]
  const rec: LevelRecord = { stars: Math.max(prev?.stars ?? 0, r.stars), bestMs: prev?.bestMs ? Math.min(prev.bestMs, r.ms) : r.ms, bestScore: Math.max(prev?.bestScore ?? 0, r.score) }
  const levels = { ...s.levels, [r.n]: rec }
  const next: MazeSave = { ...s, levels, unlocked: Math.max(s.unlocked, Math.min(CAMPAIGN_LEVELS, r.n + 1)), coins: s.coins + r.coins }
  const have = new Set(s.achievements)
  const now = new Set<string>(['first-exit'])
  if (r.n >= 4 && r.hits === 0) now.add('untouched')
  if (r.doors >= 2) now.add('key-master')
  if (r.fog) now.add('fog-walker')
  if (next.coins >= 100) now.add('coin-hoarder')
  for (const [n, id] of [[10, 'level-10'], [25, 'level-25'], [50, 'level-50']] as const) if (r.n >= n || levels[n]) now.add(id)
  if (Object.values(levels).filter((l) => l.stars === 3).length >= 10) now.add('star-collector')
  const earned = [...now].filter((id) => !have.has(id))
  return { save: { ...next, achievements: [...s.achievements, ...earned] }, earned }
}

/** Folds a finished Endless run into the personal-best list (best 10 by mazes, then distance, then quickest). */
export function recordEndless(s: MazeSave, run: EndlessRun): { save: MazeSave; earned: string[]; best: boolean } {
  const top = [...s.endless.top, run].sort((a, b) => b.mazes - a.mazes || b.distance - a.distance || a.timeMs - b.timeMs).slice(0, 10)
  const have = new Set(s.achievements)
  const earned = ([[5, 'endless-5'], [15, 'endless-15']] as const).filter(([n, id]) => run.mazes >= n && !have.has(id)).map(([, id]) => id)
  return { save: { ...s, endless: { top }, achievements: [...s.achievements, ...earned] }, earned, best: top[0] === run && run.mazes > 0 }
}
