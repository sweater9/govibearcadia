import { shuffle, type Random } from '../../lib/rng'
import { LEVELS, type LevelDef } from './levels'

/** Pure rules for Pixel Run: no React, no browser APIs, so a server can replay a run. Units are world pixels; a tile is 16. */
export const TILE = 16
export const VIEW_W = 240
export const VIEW_H = 144
export const PW = 10
export const PH = 14
export const EW = 12
export const EH = 12

const RUN = 92
const ACCEL_GROUND = 1100
const ACCEL_AIR = 650
const FRICTION = 1300
const GRAVITY = 900
const JUMP_V = 290
const JUMP_CUT = 110
const MAX_FALL = 420
const STOMP_V = 200
const COYOTE = 0.1
const BUFFER = 0.1
const INVULN = 1.2
const COIN_POINTS = 10
const STOMP_POINTS = 50
const CLEAR_POINTS = 100
const TIME_POINTS = 2

export type Difficulty = 'easy' | 'normal' | 'hard'
export const DIFFICULTY: Record<Difficulty, { label: string; lives: number; time: number; enemy: number; extraCoins: number }> = {
  easy: { label: 'Easy', lives: 5, time: 120, enemy: 22, extraCoins: 8 },
  normal: { label: 'Normal', lives: 3, time: 80, enemy: 30, extraCoins: 6 },
  hard: { label: 'Hard', lives: 2, time: 55, enemy: 42, extraCoins: 4 },
}

export type Input = { left: boolean; right: boolean; jump: boolean; jumpPressed: boolean }
export const NO_INPUT: Input = { left: false, right: false, jump: false, jumpPressed: false }

export type Pt = { x: number; y: number }
export type Enemy = { x: number; y: number; dir: 1 | -1; alive: boolean }
export type Coin = Pt & { got: boolean }

type Parsed = { name: string; w: number; h: number; solid: boolean[]; spikes: Pt[]; coins: Pt[]; enemies: Pt[]; start: Pt; flag: Pt }

const cache = new Map<LevelDef, Parsed>()
export function parseLevel(def: LevelDef): Parsed {
  const hit = cache.get(def)
  if (hit) return hit
  const h = def.rows.length
  const w = def.rows[0].length
  const p: Parsed = { name: def.name, w, h, solid: new Array(w * h).fill(false), spikes: [], coins: [], enemies: [], start: { x: 1, y: 1 }, flag: { x: w - 2, y: 1 } }
  def.rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const c = row[x]
      if (c === '#') p.solid[y * w + x] = true
      else if (c === '^') p.spikes.push({ x, y })
      else if (c === 'o') p.coins.push({ x, y })
      else if (c === 'E') p.enemies.push({ x, y })
      else if (c === 'P') p.start = { x, y }
      else if (c === 'F') p.flag = { x, y }
    }
  })
  cache.set(def, p)
  return p
}

export type PStatus = 'ready' | 'playing' | 'won' | 'lost'
export type PState = {
  status: PStatus
  difficulty: Difficulty
  order: number[]
  extra: Pt[][]
  stage: number
  x: number
  y: number
  vx: number
  vy: number
  facing: 1 | -1
  onGround: boolean
  coyote: number
  buffer: number
  jumpPrev: boolean
  enemies: Enemy[]
  coins: Coin[]
  lives: number
  score: number
  coinsGot: number
  stomps: number
  deaths: number
  timeLeft: number
  invuln: number
  levelsDone: number
}

export const levelOf = (s: PState): Parsed => parseLevel(LEVELS[s.order[Math.min(s.stage, s.order.length - 1)]])

/** Seeded extra coins: empty tiles standing on solid ground, away from the start and the flag. */
function pickExtra(def: LevelDef, count: number, random: Random): Pt[] {
  const lv = parseLevel(def)
  const spots: Pt[] = []
  for (let y = 1; y < lv.h; y++)
    for (let x = 5; x < lv.w - 5; x++) {
      if (def.rows[y][x] === '.' && lv.solid[y * lv.w + x] === false && y + 1 < lv.h && def.rows[y + 1][x] === '#') spots.push({ x, y })
    }
  return shuffle(spots, random).slice(0, count)
}

export function enterStage(s: PState, stage: number): PState {
  const lv = parseLevel(LEVELS[s.order[stage]])
  const cfg = DIFFICULTY[s.difficulty]
  return {
    ...s,
    stage,
    x: lv.start.x * TILE + (TILE - PW) / 2,
    y: (lv.start.y + 1) * TILE - PH,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: true,
    coyote: 0,
    buffer: 0,
    jumpPrev: false,
    enemies: lv.enemies.map((e) => ({ x: e.x * TILE + (TILE - EW) / 2, y: (e.y + 1) * TILE - EH, dir: -1, alive: true })),
    coins: [...lv.coins, ...s.extra[stage]].map((c) => ({ ...c, got: false })),
    timeLeft: cfg.time,
    invuln: INVULN,
  }
}

export function newGame(difficulty: Difficulty, random: Random): PState {
  const order = shuffle(LEVELS.map((_, i) => i), random)
  const extra = order.map((i) => pickExtra(LEVELS[i], DIFFICULTY[difficulty].extraCoins, random))
  const base: PState = {
    status: 'ready', difficulty, order, extra, stage: 0, x: 0, y: 0, vx: 0, vy: 0, facing: 1, onGround: true, coyote: 0, buffer: 0, jumpPrev: false,
    enemies: [], coins: [], lives: DIFFICULTY[difficulty].lives, score: 0, coinsGot: 0, stomps: 0, deaths: 0, timeLeft: 0, invuln: 0, levelsDone: 0,
  }
  return enterStage(base, 0)
}

export const start = (s: PState): PState => (s.status === 'ready' ? { ...s, status: 'playing' } : s)

/** Camera left edge in world pixels. */
export function cameraX(s: PState): number {
  const lv = levelOf(s)
  return Math.max(0, Math.min(lv.w * TILE - VIEW_W, s.x + PW / 2 - VIEW_W / 2))
}

const isSolid = (lv: Parsed, tx: number, ty: number) => tx < 0 || tx >= lv.w || (ty >= 0 && ty < lv.h && lv.solid[ty * lv.w + tx])

function hitsSolid(lv: Parsed, x: number, y: number, w: number, h: number): boolean {
  const x0 = Math.floor(x / TILE)
  const x1 = Math.floor((x + w - 0.001) / TILE)
  const y0 = Math.floor(y / TILE)
  const y1 = Math.floor((y + h - 0.001) / TILE)
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolid(lv, tx, ty)) return true
  return false
}

const overlap = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by

function die(s: PState): PState {
  const lives = s.lives - 1
  const deaths = s.deaths + 1
  if (lives <= 0) return { ...s, lives: 0, deaths, status: 'lost', vx: 0 }
  // Respawn at the level start with every walker back, keeping collected coins.
  const fresh = enterStage({ ...s, lives, deaths }, s.stage)
  return { ...fresh, coins: s.coins }
}

function moveEnemy(lv: Parsed, e: Enemy, speed: number, dt: number): Enemy {
  if (!e.alive) return e
  const nx = e.x + e.dir * speed * dt
  const frontX = e.dir > 0 ? nx + EW : nx
  const tx = Math.floor(frontX / TILE)
  const row = Math.floor((e.y + EH - 0.001) / TILE)
  const wall = isSolid(lv, tx, row)
  const ledge = !isSolid(lv, tx, row + 1)
  if (wall || ledge) return { ...e, dir: e.dir > 0 ? -1 : 1 }
  return { ...e, x: nx }
}

export function step(s: PState, dt: number, input: Input): PState {
  if (s.status !== 'playing') return s
  const lv = levelOf(s)
  const cfg = DIFFICULTY[s.difficulty]

  const timeLeft = s.timeLeft - dt
  if (timeLeft <= 0) return die({ ...s, timeLeft: 0 })

  let { x, y, vx, vy, facing, coyote, buffer } = s
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  if (dir !== 0) facing = dir > 0 ? 1 : -1
  const accel = s.onGround ? ACCEL_GROUND : ACCEL_AIR
  if (dir !== 0) {
    const target = dir * RUN
    vx += Math.sign(target - vx) * Math.min(Math.abs(target - vx), accel * dt)
  } else if (s.onGround) vx += Math.sign(-vx) * Math.min(Math.abs(vx), FRICTION * dt)

  coyote = s.onGround ? COYOTE : Math.max(0, coyote - dt)
  const pressed = input.jumpPressed || (input.jump && !s.jumpPrev)
  buffer = pressed ? BUFFER : Math.max(0, buffer - dt)
  let onGround = false
  if (buffer > 0 && coyote > 0) {
    vy = -JUMP_V
    buffer = 0
    coyote = 0
  }
  if (!input.jump && vy < -JUMP_CUT) vy = -JUMP_CUT
  vy = Math.min(MAX_FALL, vy + GRAVITY * dt)

  // Horizontal move, then vertical, each resolved against the tiles.
  x += vx * dt
  if (hitsSolid(lv, x, y, PW, PH)) {
    x = vx > 0 ? Math.floor((x + PW) / TILE) * TILE - PW : (Math.floor(x / TILE) + 1) * TILE
    vx = 0
  }
  y += vy * dt
  if (hitsSolid(lv, x, y, PW, PH)) {
    if (vy > 0) {
      y = Math.floor((y + PH) / TILE) * TILE - PH
      onGround = true
    } else y = (Math.floor(y / TILE) + 1) * TILE
    vy = 0
  }

  let next: PState = { ...s, x, y, vx, vy, facing, coyote, buffer, onGround, jumpPrev: input.jump, timeLeft, invuln: Math.max(0, s.invuln - dt) }

  if (y > lv.h * TILE + 8) return die(next)

  // Walkers and stomping.
  let hurt = false
  let stomped = 0
  const enemies = next.enemies.map((raw) => {
    const e = moveEnemy(lv, raw, cfg.enemy, dt)
    if (!e.alive || !overlap(x, y, PW, PH, e.x, e.y, EW, EH)) return e
    if (vy > 0 && y + PH - vy * dt <= e.y + 4) {
      stomped++
      return { ...e, alive: false }
    }
    hurt = true
    return e
  })
  next = { ...next, enemies }
  if (stomped) next = { ...next, vy: -STOMP_V, onGround: false, stomps: next.stomps + stomped, score: next.score + STOMP_POINTS * stomped }

  // Spikes only hurt on their lower half.
  if (next.invuln <= 0) {
    for (const sp of lv.spikes) if (overlap(x, y, PW, PH, sp.x * TILE + 2, sp.y * TILE + 8, TILE - 4, 8)) hurt = true
    if (hurt) return die(next)
  }

  // Coins.
  let gotNow = 0
  const coins = next.coins.map((c) => {
    if (c.got || !overlap(x, y, PW, PH, c.x * TILE + 4, c.y * TILE + 4, 8, 8)) return c
    gotNow++
    return { ...c, got: true }
  })
  if (gotNow) next = { ...next, coins, coinsGot: next.coinsGot + gotNow, score: next.score + COIN_POINTS * gotNow }

  // Flag: clear the stage, bank a time bonus, move on or win.
  if (overlap(x, y, PW, PH, lv.flag.x * TILE + 4, (lv.flag.y - 1) * TILE, 8, TILE * 2)) {
    const score = next.score + CLEAR_POINTS + Math.floor(next.timeLeft) * TIME_POINTS
    const levelsDone = next.levelsDone + 1
    if (levelsDone >= next.order.length) return { ...next, score, levelsDone, status: 'won', vx: 0 }
    return enterStage({ ...next, score, levelsDone }, next.stage + 1)
  }
  return next
}
