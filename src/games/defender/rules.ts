import type { Random } from '../../lib/rng'

/** Pure Space Defender rules: a formation of invaders, auto-firing ship, five waves. No React or browser APIs. Field units. */

export const W = 320
export const H = 420
export const COLS = 6
export const ROWS = 4
export const ENEMY_W = 20
export const ENEMY_H = 14
export const SPACING_X = 32
export const SPACING_Y = 24
export const FORM_TOP = 44
export const EDGE = 8
export const DROP = 14
export const SHIP_W = 26
export const SHIP_H = 14
export const SHIP_Y = H - 30
export const SHIP_SPEED = 260
export const BULLET_SPEED = 420
export const BULLET_W = 3
export const BULLET_H = 10
export const SHOT_W = 4
export const FIRE_EVERY = 0.28
export const MAX_BULLETS = 4
export const LIVES = 3
export const WAVES = 5
export const INVULN = 1.5
/** Points per invader by row, top row first. */
export const ROW_POINTS = [40, 30, 20, 10]
export const TOTAL = COLS * ROWS
const FORM_W = (COLS - 1) * SPACING_X + ENEMY_W
const FORM_START_X = (W - FORM_W) / 2
const SLICE = 1 / 60

export type Status = 'ready' | 'playing' | 'won' | 'lost'
export type Shot = { x: number; y: number }
export type DefenderState = {
  shipX: number
  /** Row-major, true while the invader lives. */
  enemies: boolean[]
  formX: number
  formY: number
  formDir: 1 | -1
  bullets: Shot[]
  shots: Shot[]
  wave: number
  lives: number
  score: number
  status: Status
  fireCd: number
  enemyCd: number
  /** Seconds of protection left after the ship was hit. */
  invuln: number
}

export const newGame = (): DefenderState => ({
  shipX: W / 2,
  enemies: Array<boolean>(TOTAL).fill(true),
  formX: FORM_START_X,
  formY: FORM_TOP,
  formDir: 1,
  bullets: [],
  shots: [],
  wave: 1,
  lives: LIVES,
  score: 0,
  status: 'ready',
  fireCd: 0,
  enemyCd: 1.2,
  invuln: 0,
})

export const enemyPos = (s: Pick<DefenderState, 'formX' | 'formY'>, i: number) => ({
  x: s.formX + (i % COLS) * SPACING_X,
  y: s.formY + Math.floor(i / COLS) * SPACING_Y,
})

export const aliveCount = (s: Pick<DefenderState, 'enemies'>) => s.enemies.reduce((n, e) => n + (e ? 1 : 0), 0)

/** Formation speed: faster each wave, and faster as the formation thins out. */
export const formSpeed = (wave: number, alive: number): number => 26 + 8 * wave + (TOTAL - alive) * 3

const clampShip = (x: number) => Math.min(W - SHIP_W / 2, Math.max(SHIP_W / 2, x))

export function moveShip(state: DefenderState, x: number): DefenderState {
  if (state.status === 'won' || state.status === 'lost') return state
  const shipX = clampShip(x)
  return shipX === state.shipX ? state : { ...state, shipX }
}

/** Starts the fight. The ship fires on its own from here. */
export function start(state: DefenderState): DefenderState {
  return state.status === 'ready' ? { ...state, status: 'playing' } : state
}

const overlap = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by

/** Advances `dt` seconds in slices of at most 1/60 s. `random` is drawn from only when invaders fire. */
export function step(state: DefenderState, dt: number, dir: -1 | 0 | 1 = 0, random: Random = Math.random): DefenderState {
  if (state.status === 'won' || state.status === 'lost') return state
  let s = dir ? moveShip(state, state.shipX + dir * SHIP_SPEED * dt) : state
  if (s.status !== 'playing') return s
  const parts = Math.max(1, Math.ceil(dt / SLICE - 1e-9))
  for (let i = 0; i < parts && s.status === 'playing'; i++) s = tick(s, dt / parts, random)
  return s
}

function tick(state: DefenderState, h: number, random: Random): DefenderState {
  let { formX, formY, formDir, fireCd, enemyCd, invuln, lives, score } = state
  const wave = state.wave
  let enemies = state.enemies
  let bullets = state.bullets.map((b) => ({ x: b.x, y: b.y - BULLET_SPEED * h })).filter((b) => b.y + BULLET_H > 0)
  let shots = state.shots.map((b) => ({ x: b.x, y: b.y + (130 + 12 * wave) * h })).filter((b) => b.y < H)
  invuln = Math.max(0, invuln - h)

  // Formation: march, and turn and drop at the edge of the live invaders.
  const alive = aliveCount(state)
  let minC = COLS
  let maxC = -1
  for (let i = 0; i < TOTAL; i++) {
    if (!enemies[i]) continue
    minC = Math.min(minC, i % COLS)
    maxC = Math.max(maxC, i % COLS)
  }
  formX += formDir * formSpeed(wave, alive) * h
  if (formDir === 1 && formX + maxC * SPACING_X + ENEMY_W > W - EDGE) {
    formX = W - EDGE - ENEMY_W - maxC * SPACING_X
    formDir = -1
    formY += DROP
  } else if (formDir === -1 && formX + minC * SPACING_X < EDGE) {
    formX = EDGE - minC * SPACING_X
    formDir = 1
    formY += DROP
  }

  // The ship fires on its own, a few shots at a time.
  fireCd -= h
  if (fireCd <= 0 && bullets.length < MAX_BULLETS) {
    bullets = [...bullets, { x: state.shipX - BULLET_W / 2, y: SHIP_Y - BULLET_H }]
    fireCd = FIRE_EVERY
  }

  // Invaders fire from the bottom of a random live column.
  enemyCd -= h
  if (enemyCd <= 0) {
    const cols: number[] = []
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (enemies[r * COLS + c]) { cols.push(c); break }
    if (cols.length) {
      const c = cols[Math.floor(random() * cols.length)]
      let r = ROWS - 1
      while (!enemies[r * COLS + c]) r--
      const p = enemyPos({ formX, formY }, r * COLS + c)
      shots = [...shots, { x: p.x + ENEMY_W / 2 - SHOT_W / 2, y: p.y + ENEMY_H }]
    }
    enemyCd = Math.max(0.35, 1.0 - 0.1 * (wave - 1)) * (0.7 + 0.6 * random())
  }

  // Player bullets against invaders (each bullet takes out at most one).
  const spent = new Set<number>()
  for (let b = 0; b < bullets.length; b++) {
    for (let i = 0; i < TOTAL; i++) {
      if (!enemies[i]) continue
      const p = enemyPos({ formX, formY }, i)
      if (overlap(bullets[b].x, bullets[b].y, BULLET_W, BULLET_H, p.x, p.y, ENEMY_W, ENEMY_H)) {
        if (enemies === state.enemies) enemies = enemies.slice()
        enemies[i] = false
        score += ROW_POINTS[Math.floor(i / COLS)]
        spent.add(b)
        break
      }
    }
  }
  if (spent.size) bullets = bullets.filter((_, b) => !spent.has(b))

  // Invader shots against the ship, unless it is still protected.
  if (invuln === 0) {
    const hit = shots.findIndex((b) => overlap(b.x, b.y, SHOT_W, BULLET_H, state.shipX - SHIP_W / 2, SHIP_Y, SHIP_W, SHIP_H))
    if (hit >= 0) {
      shots = shots.filter((_, k) => k !== hit)
      lives -= 1
      invuln = INVULN
    }
  }

  const base = { ...state, enemies, formX, formY, formDir, bullets, shots, fireCd, enemyCd, invuln, wave, lives, score }
  if (lives <= 0) return { ...base, lives: 0, status: 'lost' }

  // Invaders reaching the ship's line ends the game at once.
  for (let i = 0; i < TOTAL; i++) {
    if (enemies[i] && enemyPos({ formX, formY }, i).y + ENEMY_H >= SHIP_Y) return { ...base, status: 'lost' }
  }

  if (aliveCount(base) === 0) {
    if (wave >= WAVES) return { ...base, score: score + 100 * wave + 200 * lives, status: 'won' }
    return {
      ...base,
      wave: wave + 1,
      score: score + 100 * wave,
      enemies: Array<boolean>(TOTAL).fill(true),
      formX: FORM_START_X,
      formY: FORM_TOP,
      formDir: 1,
      bullets: [],
      shots: [],
      enemyCd: 1.2,
    }
  }
  return base
}
