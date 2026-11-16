import { createRandom } from '../../lib/rng'

/**
 * Pure rules for Tower Defense: a fixed winding path across a 10 by 8 grid, three kinds of tower that can be upgraded,
 * three kinds of enemy, twelve waves. Stepping is fixed-timestep (50 ms), so a seed and a list of player actions always
 * play out identically. No React or browser APIs.
 *
 * Space is measured in cells: cell (c, r) covers x from c to c + 1 and y from r to r + 1.
 */
export const COLS = 10
export const ROWS = 8
export const WAVES = 12
/** The fixed simulation step in milliseconds. */
export const TICK = 50

export type Level = 'easy' | 'normal' | 'hard'
export const LEVELS: Record<Level, { gold: number; lives: number; hp: number; score: number }> = {
  easy: { gold: 190, lives: 25, hp: 0.8, score: 0.8 },
  normal: { gold: 150, lives: 20, hp: 1, score: 1 },
  hard: { gold: 120, lives: 12, hp: 1.3, score: 1.3 },
}

export type TowerKind = 'basic' | 'slow' | 'splash'
export const TOWERS: Record<TowerKind, { name: string; cost: number; range: number; damage: number; cooldown: number; blurb: string }> = {
  basic: { name: 'Bolt', cost: 50, range: 2.5, damage: 9, cooldown: 550, blurb: 'Fast, steady shots' },
  slow: { name: 'Frost', cost: 60, range: 2.2, damage: 2, cooldown: 800, blurb: 'Slows what it hits' },
  splash: { name: 'Blast', cost: 90, range: 2.4, damage: 14, cooldown: 1300, blurb: 'Hurts a small crowd' },
}
export const KINDS: readonly TowerKind[] = ['basic', 'slow', 'splash']
export const MAX_TOWER_LEVEL = 3
const SPLASH_RADIUS = 1.1
const SLOW_MS = 1600
const SLOW_FACTOR = 0.5

export type EnemyKind = 'walker' | 'fast' | 'armoured'
export const ENEMIES: Record<EnemyKind, { hp: number; speed: number; armour: number; bounty: number; leak: number }> = {
  walker: { hp: 30, speed: 1, armour: 0, bounty: 5, leak: 1 },
  fast: { hp: 18, speed: 2, armour: 0, bounty: 6, leak: 1 },
  armoured: { hp: 90, speed: 0.7, armour: 3, bounty: 12, leak: 2 },
}

// ---- The map -----------------------------------------------------------------------------------------------------

/** Where enemies walk, as points in cell units: in from the left edge, out through the bottom. */
export const WAYPOINTS: readonly (readonly [number, number])[] = [[-0.5, 1.5], [7.5, 1.5], [7.5, 3.5], [2.5, 3.5], [2.5, 5.5], [8.5, 5.5], [8.5, 8]]

const SEG_LEN = WAYPOINTS.slice(1).map((p, i) => Math.hypot(p[0] - WAYPOINTS[i][0], p[1] - WAYPOINTS[i][1]))
export const PATH_LENGTH = SEG_LEN.reduce((a, b) => a + b, 0)

/** Position of something that has walked `d` cells along the path. */
export function pathPoint(d: number): [number, number] {
  let left = Math.max(0, Math.min(PATH_LENGTH, d))
  for (let i = 0; i < SEG_LEN.length; i++) {
    if (left <= SEG_LEN[i] || i === SEG_LEN.length - 1) {
      const t = SEG_LEN[i] === 0 ? 0 : left / SEG_LEN[i]
      const a = WAYPOINTS[i]
      const b = WAYPOINTS[i + 1]
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    }
    left -= SEG_LEN[i]
  }
  return [...WAYPOINTS[WAYPOINTS.length - 1]] as [number, number]
}

const PATH_SET = (() => {
  const out = new Set<string>()
  for (let d = 0; d <= PATH_LENGTH; d += 0.1) {
    const [x, y] = pathPoint(d)
    const c = Math.floor(x + 1e-6)
    const r = Math.floor(y + 1e-6)
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) out.add(`${c},${r}`)
  }
  return out
})()
export const isPath = (c: number, r: number) => PATH_SET.has(`${c},${r}`)
export const inGrid = (c: number, r: number) => Number.isInteger(c) && Number.isInteger(r) && c >= 0 && c < COLS && r >= 0 && r < ROWS

// ---- State -------------------------------------------------------------------------------------------------------

export type Tower = { id: number; kind: TowerKind; c: number; r: number; level: number; cooldown: number; spent: number }
export type Enemy = { id: number; kind: EnemyKind; hp: number; maxHp: number; d: number; slow: number }
export type Shot = { id: number; x1: number; y1: number; x2: number; y2: number; kind: TowerKind; ttl: number }
export type Status = 'build' | 'wave' | 'won' | 'lost'

export type State = {
  seed: string
  level: Level
  status: Status
  /** Waves started so far; the wave in progress while status is 'wave'. */
  wave: number
  lives: number
  gold: number
  towers: Tower[]
  enemies: Enemy[]
  shots: Shot[]
  /** Enemies still to arrive in the current wave, with the time since the wave began at which each appears. */
  queue: { t: number; kind: EnemyKind }[]
  waveTime: number
  acc: number
  /** Milliseconds of play so far. */
  played: number
  kills: number
  leaked: number
  nextId: number
}

export function newGame(seed = 'tower', level: Level = 'normal'): State {
  const L = LEVELS[level]
  return { seed, level, status: 'build', wave: 0, lives: L.lives, gold: L.gold, towers: [], enemies: [], shots: [], queue: [], waveTime: 0, acc: 0, played: 0, kills: 0, leaked: 0, nextId: 1 }
}

export const isOver = (s: State) => s.status === 'won' || s.status === 'lost'
export const towerAt = (s: State, c: number, r: number) => s.towers.find((t) => t.c === c && t.r === r)

/** What the next wave will send, in order: enemy kinds with their spawn times. Pure for a seed and wave number. */
export function waveQueue(seed: string, wave: number): { t: number; kind: EnemyKind }[] {
  const rnd = createRandom(`${seed}:wave:${wave}`)
  const count = 6 + Math.round(wave * 1.8)
  const gap = Math.max(450, 900 - wave * 35)
  const out: { t: number; kind: EnemyKind }[] = []
  for (let i = 0; i < count; i++) {
    const roll = rnd()
    let kind: EnemyKind = 'walker'
    if (wave >= 5 && roll < Math.min(0.4, 0.1 + wave * 0.03)) kind = 'armoured'
    else if (wave >= 3 && roll > 0.65) kind = 'fast'
    // Fast enemies come in a tight pair now and then, which keeps waves from being a steady drip.
    out.push({ t: Math.round(i * gap + (kind === 'fast' ? -gap * 0.3 : 0)), kind })
  }
  return out.sort((a, b) => a.t - b.t).map((e) => ({ ...e, t: Math.max(0, e.t) }))
}

export const buildCost = (kind: TowerKind) => TOWERS[kind].cost
export const upgradeCost = (t: Tower) => (t.level >= MAX_TOWER_LEVEL ? Infinity : Math.round(TOWERS[t.kind].cost * 0.7 * t.level))
export const towerRange = (t: Tower) => TOWERS[t.kind].range + 0.25 * (t.level - 1)
export const towerDamage = (t: Tower) => Math.round(TOWERS[t.kind].damage * (1 + 0.5 * (t.level - 1)))

export type Refusal = 'path' | 'taken' | 'gold' | 'edge' | 'max' | 'none'

/** Why a tower cannot go on this cell, or null when it can. */
export function whyNot(s: State, kind: TowerKind, c: number, r: number): Refusal | null {
  if (isOver(s)) return 'none'
  if (!inGrid(c, r)) return 'edge'
  if (isPath(c, r)) return 'path'
  if (towerAt(s, c, r)) return 'taken'
  if (s.gold < TOWERS[kind].cost) return 'gold'
  return null
}

/** Builds a tower. Returns the same object when it is not allowed. */
export function build(s: State, kind: TowerKind, c: number, r: number): State {
  if (!(kind in TOWERS) || whyNot(s, kind, c, r) !== null) return s
  const t: Tower = { id: s.nextId, kind, c, r, level: 1, cooldown: 0, spent: TOWERS[kind].cost }
  return { ...s, towers: [...s.towers, t], gold: s.gold - TOWERS[kind].cost, nextId: s.nextId + 1 }
}

/** Upgrades the tower on a cell. Returns the same object when there is none, it is maxed, or gold is short. */
export function upgrade(s: State, c: number, r: number): State {
  const t = towerAt(s, c, r)
  if (!t || isOver(s)) return s
  const cost = upgradeCost(t)
  if (t.level >= MAX_TOWER_LEVEL || s.gold < cost) return s
  return { ...s, gold: s.gold - cost, towers: s.towers.map((x) => (x === t ? { ...x, level: x.level + 1, spent: x.spent + cost } : x)) }
}

/** Sends the next wave. Only between waves. */
export function startWave(s: State): State {
  if (s.status !== 'build' || s.wave >= WAVES) return s
  const wave = s.wave + 1
  return { ...s, status: 'wave', wave, queue: waveQueue(s.seed, wave), waveTime: 0, acc: 0 }
}

export const enemyPos = (e: Enemy) => pathPoint(e.d)

function tick(s: State): State {
  const dt = TICK / 1000
  let { gold, lives, kills, leaked, nextId } = s
  const L = LEVELS[s.level]
  const waveTime = s.waveTime + TICK

  // Arrivals.
  const queue = [...s.queue]
  let enemies = s.enemies.map((e) => ({ ...e }))
  while (queue.length && queue[0].t <= waveTime) {
    const q = queue.shift()!
    const hp = Math.round(ENEMIES[q.kind].hp * L.hp * (1 + 0.12 * (s.wave - 1)))
    enemies.push({ id: nextId++, kind: q.kind, hp, maxHp: hp, d: 0, slow: 0 })
  }

  // Towers fire at the enemy furthest along the path inside their range.
  const shots = s.shots.map((x) => ({ ...x, ttl: x.ttl - TICK })).filter((x) => x.ttl > 0)
  const towers = s.towers.map((t) => {
    const cooldown = Math.max(0, t.cooldown - TICK)
    if (cooldown > 0) return cooldown === t.cooldown ? t : { ...t, cooldown }
    const cx = t.c + 0.5
    const cy = t.r + 0.5
    const reach = towerRange(t)
    let target: Enemy | null = null
    for (const e of enemies) {
      const [x, y] = enemyPos(e)
      if (Math.hypot(x - cx, y - cy) <= reach && (!target || e.d > target.d)) target = e
    }
    if (!target) return { ...t, cooldown: 0 }
    const [tx, ty] = enemyPos(target)
    const dmg = towerDamage(t)
    const hit = (e: Enemy, amount: number) => {
      e.hp -= Math.max(1, amount - ENEMIES[e.kind].armour)
    }
    hit(target, dmg)
    if (t.kind === 'slow') target.slow = SLOW_MS
    if (t.kind === 'splash') {
      for (const e of enemies) {
        if (e === target) continue
        const [x, y] = enemyPos(e)
        if (Math.hypot(x - tx, y - ty) <= SPLASH_RADIUS) hit(e, Math.round(dmg / 2))
      }
    }
    shots.push({ id: nextId++, x1: cx, y1: cy, x2: tx, y2: ty, kind: t.kind, ttl: 150 })
    return { ...t, cooldown: TOWERS[t.kind].cooldown }
  })

  // Deaths pay out; then everything else walks, and what reaches the end costs lives.
  const alive: Enemy[] = []
  for (const e of enemies) {
    if (e.hp <= 0) {
      gold += ENEMIES[e.kind].bounty
      kills++
    } else alive.push(e)
  }
  enemies = []
  for (const e of alive) {
    const speed = ENEMIES[e.kind].speed * (e.slow > 0 ? SLOW_FACTOR : 1)
    const d = e.d + speed * dt
    if (d >= PATH_LENGTH) {
      lives -= ENEMIES[e.kind].leak
      leaked++
    } else enemies.push({ ...e, d, slow: Math.max(0, e.slow - TICK) })
  }

  let status: Status = s.status
  if (lives <= 0) {
    lives = 0
    status = 'lost'
  } else if (!queue.length && !enemies.length) {
    gold += 20 + 5 * s.wave
    status = s.wave >= WAVES ? 'won' : 'build'
  }
  return { ...s, status, gold, lives, kills, leaked, nextId, towers, enemies, shots, queue, waveTime, played: s.played + TICK }
}

/** Advances the game by `dtMs` of play, in fixed steps. Does nothing between waves or once over. */
export function step(s: State, dtMs: number): State {
  if (s.status !== 'wave' || !(dtMs > 0)) return s
  let cur: State = { ...s, acc: s.acc + dtMs }
  let guard = 0
  while (cur.acc >= TICK && cur.status === 'wave' && guard++ < 400) {
    cur = tick({ ...cur, acc: cur.acc - TICK })
  }
  return cur
}

/** Stats for the result screen and for onFinish. */
export function wavesCleared(s: State): number {
  return s.status === 'won' ? WAVES : s.status === 'build' ? s.wave : Math.max(0, s.wave - 1)
}

/** Kills and cleared waves count, a win pays well and lives left add to it; harder levels multiply it. */
export function score(s: State): number {
  const base = s.kills * 10 + wavesCleared(s) * 100 + (s.status === 'won' ? 500 + s.lives * 40 : 0)
  return Math.round(base * LEVELS[s.level].score)
}
