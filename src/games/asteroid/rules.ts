import type { Random } from '../../lib/rng'

/**
 * Pure rules for Asteroid Assault: an inertial ship (rotate, thrust, drift) in a wrapping 100 x 100 field, rocks that
 * split when shot, endless waves. No React or browser APIs.
 */
export const SIZE = 100
export type Level = 'easy' | 'normal' | 'hard'
export const LEVELS: Record<Level, { lives: number; rocks: number; speed: number; label: string }> = {
  easy: { lives: 5, rocks: 2, speed: 0.75, label: 'Easy' },
  normal: { lives: 3, rocks: 3, speed: 1, label: 'Normal' },
  hard: { lives: 2, rocks: 4, speed: 1.3, label: 'Hard' },
}
export const TURN_SPEED = 3.6 // radians per second
export const THRUST = 55 // units per second squared
export const DRAG = 0.35 // fraction of speed lost per second
export const MAX_SPEED = 55
export const BULLET_SPEED = 80
export const BULLET_LIFE = 0.9
export const FIRE_GAP = 0.22
export const MAX_BULLETS = 5
export const SHIP_R = 2.2
export const RADIUS = { 3: 7, 2: 4, 1: 2.2 } as const
export const POINTS = { 3: 20, 2: 50, 1: 100 } as const
export const INVULN = 2.2
export const WAVE_DELAY = 1.2
export const EXTRA_LIFE = 3000

export type Size = 1 | 2 | 3
export type Rock = { x: number; y: number; vx: number; vy: number; size: Size; spin: number }
export type Bullet = { x: number; y: number; vx: number; vy: number; life: number }
export type Input = { turn: -1 | 0 | 1; thrust: boolean; fire: boolean }
export const NO_INPUT: Input = { turn: 0, thrust: false, fire: false }

export type AState = {
  level: Level
  status: 'ready' | 'playing' | 'lost'
  x: number
  y: number
  vx: number
  vy: number
  /** Radians, 0 pointing up, clockwise. */
  angle: number
  rocks: Rock[]
  bullets: Bullet[]
  score: number
  lives: number
  wave: number
  invuln: number
  cooldown: number
  /** Seconds until the next wave appears, while the field is clear. */
  waveIn: number
  nextLife: number
  shots: number
  hits: number
  time: number
}

const wrap = (v: number) => ((v % SIZE) + SIZE) % SIZE

export function newGame(level: Level = 'normal'): AState {
  return { level, status: 'ready', x: 50, y: 50, vx: 0, vy: 0, angle: 0, rocks: [], bullets: [], score: 0, lives: LEVELS[level].lives, wave: 0, invuln: 0, cooldown: 0, waveIn: 0, nextLife: EXTRA_LIFE, shots: 0, hits: 0, time: 0 }
}

/** The rocks of a wave, entering from the edges and never on top of the ship. */
export function spawnWave(s: AState, random: Random): Rock[] {
  const cfg = LEVELS[s.level]
  const n = cfg.rocks + s.wave
  const rocks: Rock[] = []
  for (let i = 0; i < n; i++) {
    let x = 0
    let y = 0
    do {
      const edge = random() < 0.5
      x = edge ? random() * SIZE : random() < 0.5 ? 0 : SIZE
      y = edge ? (random() < 0.5 ? 0 : SIZE) : random() * SIZE
    } while (Math.hypot(x - s.x, y - s.y) < 25)
    const a = random() * Math.PI * 2
    const v = (8 + random() * 8 + s.wave * 1.2) * cfg.speed
    rocks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: 3, spin: (random() - 0.5) * 2 })
  }
  return rocks
}

export function start(s: AState): AState {
  return s.status === 'ready' ? { ...s, status: 'playing', waveIn: 0.4 } : s
}

const split = (r: Rock, random: Random): Rock[] => {
  if (r.size === 1) return []
  const size = (r.size - 1) as Size
  return [0, 1].map((k) => {
    const a = Math.atan2(r.vy, r.vx) + (k ? 1 : -1) * (0.5 + random() * 0.6)
    const v = Math.hypot(r.vx, r.vy) * 1.35 + 4
    return { x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, size, spin: (random() - 0.5) * 3 }
  })
}

/** Advances the game by `dt` seconds. */
export function step(s: AState, dt: number, input: Input, random: Random): AState {
  if (s.status !== 'playing') return s
  const angle = s.angle + input.turn * TURN_SPEED * dt
  let vx = s.vx
  let vy = s.vy
  if (input.thrust) {
    vx += Math.sin(angle) * THRUST * dt
    vy -= Math.cos(angle) * THRUST * dt
  }
  const drag = Math.max(0, 1 - DRAG * dt)
  vx *= drag
  vy *= drag
  const sp = Math.hypot(vx, vy)
  if (sp > MAX_SPEED) {
    vx *= MAX_SPEED / sp
    vy *= MAX_SPEED / sp
  }
  const x = wrap(s.x + vx * dt)
  const y = wrap(s.y + vy * dt)

  let bullets = s.bullets
    .map((b) => ({ ...b, x: wrap(b.x + b.vx * dt), y: wrap(b.y + b.vy * dt), life: b.life - dt }))
    .filter((b) => b.life > 0)
  let cooldown = Math.max(0, s.cooldown - dt)
  let shots = s.shots
  if (input.fire && cooldown === 0 && bullets.length < MAX_BULLETS) {
    bullets = [...bullets, { x: wrap(x + Math.sin(angle) * 3), y: wrap(y - Math.cos(angle) * 3), vx: vx + Math.sin(angle) * BULLET_SPEED, vy: vy - Math.cos(angle) * BULLET_SPEED, life: BULLET_LIFE }]
    cooldown = FIRE_GAP
    shots++
  }

  let rocks = s.rocks.map((r) => ({ ...r, x: wrap(r.x + r.vx * dt), y: wrap(r.y + r.vy * dt) }))
  let score = s.score
  let hits = s.hits
  const spent = new Set<number>()
  const born: Rock[] = []
  rocks = rocks.filter((r) => {
    const i = bullets.findIndex((b, k) => !spent.has(k) && Math.hypot(b.x - r.x, b.y - r.y) < RADIUS[r.size])
    if (i < 0) return true
    spent.add(i)
    score += POINTS[r.size]
    hits++
    born.push(...split(r, random))
    return false
  })
  bullets = bullets.filter((_, k) => !spent.has(k))
  rocks = [...rocks, ...born]

  let lives = s.lives
  let nextLife = s.nextLife
  if (score >= nextLife) {
    lives++
    nextLife += EXTRA_LIFE
  }
  let invuln = Math.max(0, s.invuln - dt)
  let next: AState = { ...s, angle, x, y, vx, vy, bullets, rocks, score, hits, shots, cooldown, lives, nextLife, invuln, time: s.time + dt }

  if (invuln === 0 && rocks.some((r) => Math.hypot(r.x - x, r.y - y) < RADIUS[r.size] + SHIP_R)) {
    lives--
    invuln = INVULN
    next = { ...next, lives, invuln, x: 50, y: 50, vx: 0, vy: 0, angle: 0 }
    if (lives <= 0) return { ...next, lives: 0, status: 'lost' }
  }

  if (next.rocks.length === 0) {
    const waveIn = s.rocks.length === 0 ? s.waveIn - dt : WAVE_DELAY
    if (waveIn <= 0) {
      const wave = s.wave + 1
      const w = { ...next, wave }
      return { ...w, rocks: spawnWave(w, random), waveIn: 0 }
    }
    return { ...next, waveIn }
  }
  return next
}

export const isOver = (s: AState) => s.status === 'lost'
