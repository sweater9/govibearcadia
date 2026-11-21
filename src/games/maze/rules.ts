import { shuffle, type Random } from '../../lib/rng'

/**
 * Pure rules for Maze Runner: generation, solvability and the step/tick simulation. No React or browser APIs.
 *
 * Cells are numbered y * w + x. `walls[i]` is a bitmask of the walls round cell i: N=1, E=2, S=4, W=8 (a set bit is
 * a wall). A door occupies a cell: stepping in needs a key, which the door uses up. Every generated level is
 * solvable without crossing a trap and without damage: all keys lie in the part of the maze reachable before any
 * door, and there are exactly as many keys as doors.
 */
export type Dir = 'up' | 'right' | 'down' | 'left'
export const DIRS: Record<Dir, { dx: number; dy: number; bit: number; opp: number }> = {
  up: { dx: 0, dy: -1, bit: 1, opp: 4 },
  right: { dx: 1, dy: 0, bit: 2, opp: 8 },
  down: { dx: 0, dy: 1, bit: 4, opp: 1 },
  left: { dx: -1, dy: 0, bit: 8, opp: 2 },
}
export const DIR_LIST: Dir[] = ['up', 'right', 'down', 'left']

export type PowerKind = 'speed' | 'shield' | 'reveal' | 'time' | 'freeze'
export const POWER_KINDS: PowerKind[] = ['speed', 'shield', 'reveal', 'time', 'freeze']
export type Pt = { x: number; y: number }
export type Trap = Pt & { period: number; phase: number }
export type Power = Pt & { kind: PowerKind }

export type Config = {
  w: number
  h: number
  /** Share of inner walls removed to make loops (0 = a perfect maze with one route). */
  braid: number
  coins: number
  traps: number
  togglingTraps: boolean
  doors: number
  enemies: number
  /** Milliseconds between an enemy's steps. */
  enemyMs: number
  powers: number
  /** 0 for no time limit, otherwise a multiplier on the par time. */
  timed: number
  /** 0 for a fully visible maze, otherwise the radius you can see. */
  fog: number
}

export type Level = {
  w: number
  h: number
  walls: number[]
  start: Pt
  exit: Pt
  coins: Pt[]
  keys: Pt[]
  doors: Pt[]
  traps: Trap[]
  powers: Power[]
  enemies: Pt[]
  enemyMs: number
  /** Steps on the shortest route from start to exit (doors open). */
  par: number
  timeLimitMs: number
  fog: number
}

export const STEP_MS = 130
export const FAST_STEP_MS = 75
const idx = (l: { w: number }, p: Pt) => p.y * l.w + p.x
const at = (l: { w: number }, i: number): Pt => ({ x: i % l.w, y: Math.floor(i / l.w) })
const same = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y

/** Open neighbours of a cell (no wall between), in cell indices. */
export function openNeighbours(l: { w: number; h: number; walls: number[] }, i: number): number[] {
  const { x, y } = at(l, i)
  const out: number[] = []
  for (const d of DIR_LIST) {
    const { dx, dy, bit } = DIRS[d]
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= l.w || ny >= l.h || l.walls[i] & bit) continue
    out.push(ny * l.w + nx)
  }
  return out
}

/** Breadth-first distances from a cell; `blocked` cells are treated as walls. -1 for unreachable. */
export function distances(l: { w: number; h: number; walls: number[] }, from: number, blocked: ReadonlySet<number> = new Set()): number[] {
  const dist = new Array<number>(l.w * l.h).fill(-1)
  dist[from] = 0
  const q = [from]
  for (let h = 0; h < q.length; h++) {
    for (const n of openNeighbours(l, q[h])) {
      if (dist[n] === -1 && !blocked.has(n)) {
        dist[n] = dist[q[h]] + 1
        q.push(n)
      }
    }
  }
  return dist
}

/** The shortest route from one cell to another (inclusive), or null. */
export function route(l: { w: number; h: number; walls: number[] }, from: number, to: number, blocked: ReadonlySet<number> = new Set()): number[] | null {
  const prev = new Map<number, number>([[from, -1]])
  const q = [from]
  for (let h = 0; h < q.length; h++) {
    if (q[h] === to) break
    for (const n of openNeighbours(l, q[h])) {
      if (!prev.has(n) && !blocked.has(n)) {
        prev.set(n, q[h])
        q.push(n)
      }
    }
  }
  if (!prev.has(to)) return null
  const out: number[] = []
  for (let c = to; c !== -1; c = prev.get(c) as number) out.push(c)
  return out.reverse()
}

export function generate(cfg: Config, random: Random): Level {
  const { w, h } = cfg
  const walls = new Array<number>(w * h).fill(15)
  // Recursive backtracker: a perfect maze (exactly one route between any two cells).
  const seen = new Array<boolean>(w * h).fill(false)
  const startCell = Math.floor(random() * w * h)
  const stack = [startCell]
  seen[startCell] = true
  while (stack.length) {
    const c = stack[stack.length - 1]
    const { x, y } = at({ w }, c)
    const options = shuffle(DIR_LIST, random).filter((d) => {
      const nx = x + DIRS[d].dx
      const ny = y + DIRS[d].dy
      return nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny * w + nx]
    })
    if (!options.length) {
      stack.pop()
      continue
    }
    const d = options[0]
    const n = (y + DIRS[d].dy) * w + (x + DIRS[d].dx)
    walls[c] &= ~DIRS[d].bit
    walls[n] &= ~DIRS[d].opp
    seen[n] = true
    stack.push(n)
  }
  // Loops: knock out some inner walls.
  const inner: [number, Dir][] = []
  for (let i = 0; i < w * h; i++) {
    const { x, y } = at({ w }, i)
    if (x < w - 1 && walls[i] & DIRS.right.bit) inner.push([i, 'right'])
    if (y < h - 1 && walls[i] & DIRS.down.bit) inner.push([i, 'down'])
  }
  for (const [i, d] of shuffle(inner, random).slice(0, Math.floor(inner.length * cfg.braid))) {
    const { x, y } = at({ w }, i)
    const n = (y + DIRS[d].dy) * w + (x + DIRS[d].dx)
    walls[i] &= ~DIRS[d].bit
    walls[n] &= ~DIRS[d].opp
  }
  const shell = { w, h, walls }

  // Start anywhere on the left edge; the exit is the cell farthest from it.
  const start = { x: 0, y: Math.floor(random() * h) }
  const dist = distances(shell, idx(shell, start))
  const far = Math.max(...dist)
  const exitCell = shuffle(
    dist.flatMap((d, i) => (d === far ? [i] : [])),
    random,
  )[0]
  const exit = at(shell, exitCell)
  const startCell2 = idx(shell, start)
  const main = route(shell, startCell2, exitCell) as number[]

  const used = new Set<number>([startCell2, exitCell])
  // Doors on the main route, 25% to 85% of the way along, spread out.
  const doors: Pt[] = []
  const doorCells = new Set<number>()
  const want = Math.min(cfg.doors, Math.max(0, Math.floor((main.length - 4) / 4)))
  for (let k = 0; k < want; k++) {
    const lo = Math.floor(main.length * (0.25 + (0.6 * k) / want))
    const hi = Math.max(lo + 1, Math.floor(main.length * (0.25 + (0.6 * (k + 1)) / want)))
    const i = lo + Math.floor(random() * (hi - lo))
    const c = main[Math.min(i, main.length - 2)]
    if (used.has(c)) continue
    doorCells.add(c)
    used.add(c)
    doors.push(at(shell, c))
  }
  // Keys: only in the part of the maze reachable with every door closed.
  const before = distances(shell, startCell2, doorCells)
  const keyPool = shuffle(
    before.flatMap((d, i) => (d > 0 && !used.has(i) ? [i] : [])),
    random,
  )
  const keys: Pt[] = []
  while (keys.length < doors.length && keyPool.length) {
    const c = keyPool.pop() as number
    used.add(c)
    keys.push(at(shell, c))
  }
  // If the pool ran dry, drop doors the keys cannot pay for.
  while (doors.length > keys.length) {
    const d = doors.pop() as Pt
    doorCells.delete(idx(shell, d))
    used.delete(idx(shell, d))
  }

  // Traps stay off every route the player needs: start to exit, and start to each key.
  const needed = new Set<number>(main)
  for (const k of keys) for (const c of route(shell, startCell2, idx(shell, k), doorCells) ?? []) needed.add(c)
  const free = () => shuffle(Array.from({ length: w * h }, (_, i) => i).filter((i) => !used.has(i)), random)
  const traps: Trap[] = []
  for (const c of free().filter((i) => !needed.has(i)).slice(0, cfg.traps)) {
    used.add(c)
    traps.push({ ...at(shell, c), period: cfg.togglingTraps && random() < 0.6 ? 1600 + Math.floor(random() * 4) * 400 : 0, phase: Math.floor(random() * 1000) })
  }
  const coins = free().slice(0, cfg.coins).map((c) => (used.add(c), at(shell, c)))
  const powers = free().slice(0, cfg.powers).map((c, i) => (used.add(c), { ...at(shell, c), kind: POWER_KINDS[Math.floor(random() * POWER_KINDS.length)] ?? POWER_KINDS[i % 5] }))
  // Enemies start well away from where you do.
  const enemies = free().filter((i) => dist[i] >= 6 && !doorCells.has(i)).slice(0, cfg.enemies).map((c) => at(shell, c))

  const par = main.length - 1
  return {
    w,
    h,
    walls,
    start,
    exit,
    coins,
    keys,
    doors,
    traps,
    powers,
    enemies,
    enemyMs: cfg.enemyMs,
    par,
    timeLimitMs: cfg.timed > 0 ? Math.round(5000 + par * STEP_MS * cfg.timed) : 0,
    fog: cfg.fog,
  }
}

/**
 * True when the level can be finished without damage: the exit and every key are reachable, every key is reachable
 * with all doors closed, and there are enough keys. Used by tests and by the generator's guarantees.
 */
export function isSolvable(l: Level): boolean {
  const doorCells = new Set(l.doors.map((d) => idx(l, d)))
  const trapCells = new Set(l.traps.map((t) => idx(l, t)))
  const closed = new Set([...doorCells, ...trapCells])
  const d0 = distances(l, idx(l, l.start), closed)
  if (!l.keys.every((k) => d0[idx(l, k)] >= 0)) return false
  if (l.keys.length < l.doors.length) return false
  const d1 = distances(l, idx(l, l.start), trapCells)
  return d1[idx(l, l.exit)] >= 0
}

// ---------------------------------------------------------------- the simulation

export type Effects = { speed: number; shield: number; freeze: number; hurt: number }
export type Enemy = Pt & { last: number; acc: number }
export type Status = 'playing' | 'won' | 'lost'
export type MEvent = 'coin' | 'key' | 'door' | 'locked' | 'hit' | 'power' | 'win' | 'lose' | 'step'

export type MState = {
  level: Level
  p: Pt
  hearts: number
  maxHearts: number
  keys: number
  coinsLeft: Pt[]
  coinsGot: number
  keysLeft: Pt[]
  doorsLeft: Pt[]
  powersLeft: Power[]
  enemies: Enemy[]
  effects: Effects
  /** Time left in ms, or null when untimed. */
  timeLeft: number | null
  elapsed: number
  steps: number
  hitsTaken: number
  seen: boolean[]
  status: Status
  reason: '' | 'hearts' | 'time'
  /** What happened in the last move or tick (for sounds and announcements). */
  events: MEvent[]
}

export const HURT_PROTECT_MS = 1200
export const POWER_MS = { speed: 6000, shield: 6000, freeze: 5000 }
export const TIME_BONUS_MS = 10000
export const REVEAL_RADIUS = 6

export function newState(level: Level, hearts = 3, timeScale = 1): MState {
  const s: MState = {
    level,
    p: { ...level.start },
    hearts,
    maxHearts: hearts,
    keys: 0,
    coinsLeft: level.coins.slice(),
    coinsGot: 0,
    keysLeft: level.keys.slice(),
    doorsLeft: level.doors.slice(),
    powersLeft: level.powers.slice(),
    enemies: level.enemies.map((e) => ({ ...e, last: -1, acc: 0 })),
    effects: { speed: 0, shield: 0, freeze: 0, hurt: 0 },
    timeLeft: level.timeLimitMs ? Math.round(level.timeLimitMs * timeScale) : null,
    elapsed: 0,
    steps: 0,
    hitsTaken: 0,
    seen: new Array(level.w * level.h).fill(false),
    status: 'playing',
    reason: '',
    events: [],
  }
  return reveal(s, level.fog ? level.fog : 0, level.start)
}

/** Marks cells within `radius` (straight-line) of a point as seen. Without fog everything counts as seen. */
function reveal(s: MState, radius: number, c: Pt): MState {
  const seen = s.seen.slice()
  const { w, h } = s.level
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!s.level.fog || Math.hypot(x - c.x, y - c.y) <= radius) seen[y * w + x] = true
  return { ...s, seen }
}

export const stepMs = (s: MState) => (s.effects.speed > 0 ? FAST_STEP_MS : STEP_MS)
export const trapActive = (t: Trap, elapsed: number) => t.period === 0 || (Math.floor((elapsed + t.phase) / t.period) % 2 === 0)
const isDoor = (s: MState, p: Pt) => s.doorsLeft.some((d) => same(d, p))

function hurt(s: MState): MState {
  if (s.status !== 'playing' || s.effects.shield > 0 || s.effects.hurt > 0) return s
  const hearts = s.hearts - 1
  const lost = hearts <= 0
  return { ...s, hearts, hitsTaken: s.hitsTaken + 1, effects: { ...s.effects, hurt: HURT_PROTECT_MS }, status: lost ? 'lost' : s.status, reason: lost ? 'hearts' : s.reason, events: [...s.events, 'hit', ...(lost ? (['lose'] as MEvent[]) : [])] }
}

/** Moves the player one cell. Blocked by walls and by a door without a key; returns the same state when nothing happens. */
export function move(s: MState, dir: Dir): MState {
  if (s.status !== 'playing') return s
  const { dx, dy, bit } = DIRS[dir]
  const l = s.level
  const nx = s.p.x + dx
  const ny = s.p.y + dy
  if (nx < 0 || ny < 0 || nx >= l.w || ny >= l.h || l.walls[s.p.y * l.w + s.p.x] & bit) return s
  const to = { x: nx, y: ny }
  let n: MState = { ...s, p: to, steps: s.steps + 1, events: ['step'] }
  if (isDoor(s, to)) {
    if (s.keys === 0) return { ...s, events: ['locked'] }
    n = { ...n, keys: s.keys - 1, doorsLeft: s.doorsLeft.filter((d) => !same(d, to)), events: ['door'] }
  }
  if (n.coinsLeft.some((c) => same(c, to))) n = { ...n, coinsLeft: n.coinsLeft.filter((c) => !same(c, to)), coinsGot: n.coinsGot + 1, events: [...n.events, 'coin'] }
  if (n.keysLeft.some((k) => same(k, to))) n = { ...n, keysLeft: n.keysLeft.filter((k) => !same(k, to)), keys: n.keys + 1, events: [...n.events, 'key'] }
  const pw = n.powersLeft.find((q) => same(q, to))
  if (pw) {
    n = { ...n, powersLeft: n.powersLeft.filter((q) => q !== pw), events: [...n.events, 'power'] }
    if (pw.kind === 'speed') n = { ...n, effects: { ...n.effects, speed: POWER_MS.speed } }
    else if (pw.kind === 'shield') n = { ...n, effects: { ...n.effects, shield: POWER_MS.shield } }
    else if (pw.kind === 'freeze') n = { ...n, effects: { ...n.effects, freeze: POWER_MS.freeze } }
    else if (pw.kind === 'time') n = { ...n, timeLeft: n.timeLeft === null ? null : n.timeLeft + TIME_BONUS_MS }
    else n = reveal({ ...n, level: { ...n.level, fog: n.level.fog } }, REVEAL_RADIUS, to)
  }
  if (l.fog) n = reveal(n, l.fog, to)
  if (l.traps.some((t) => same(t, to) && trapActive(t, n.elapsed))) n = hurt(n)
  if (n.enemies.some((e) => same(e, to))) n = hurt(n)
  if (n.status === 'playing' && same(to, l.exit)) n = { ...n, status: 'won', events: [...n.events, 'win'] }
  return n
}

function enemyStep(s: MState, e: Enemy, random: Random): Enemy {
  const l = s.level
  const here = e.y * l.w + e.x
  const doorCells = new Set(s.doorsLeft.map((d) => d.y * l.w + d.x))
  const options = openNeighbours(l, here).filter((c) => !doorCells.has(c))
  if (!options.length) return e
  const pd = distances(l, s.p.y * l.w + s.p.x, doorCells)
  let next: number
  if (pd[here] > 0 && pd[here] <= 6) {
    // Chase: the neighbour closest to the player.
    const best = Math.min(...options.map((c) => (pd[c] < 0 ? 999 : pd[c])))
    next = options.filter((c) => (pd[c] < 0 ? 999 : pd[c]) === best)[0]
  } else {
    const fwd = options.filter((c) => c !== e.last)
    const pool = fwd.length ? fwd : options
    next = pool[Math.floor(random() * pool.length)]
  }
  return { x: next % l.w, y: Math.floor(next / l.w), last: here, acc: e.acc }
}

/** Advances time: the clock, power-ups wearing off, enemies walking, spikes cycling. */
export function tick(s: MState, dt: number, random: Random): MState {
  if (s.status !== 'playing' || dt <= 0) return s
  const dec = (v: number) => Math.max(0, v - dt)
  let n: MState = { ...s, events: [], elapsed: s.elapsed + dt, effects: { speed: dec(s.effects.speed), shield: dec(s.effects.shield), freeze: dec(s.effects.freeze), hurt: dec(s.effects.hurt) } }
  if (s.timeLeft !== null) {
    const left = s.timeLeft - dt
    if (left <= 0) return { ...n, timeLeft: 0, status: 'lost', reason: 'time', events: ['lose'] }
    n = { ...n, timeLeft: left }
  }
  if (s.effects.freeze <= 0 && n.enemies.length) {
    const enemies = n.enemies.map((e) => {
      let cur: Enemy = { ...e, acc: e.acc + dt }
      let guard = 0
      while (cur.acc >= n.level.enemyMs && guard++ < 4) {
        cur = { ...enemyStep(n, cur, random), acc: cur.acc - n.level.enemyMs }
      }
      return cur
    })
    n = { ...n, enemies }
  }
  if (n.enemies.some((e) => same(e, n.p))) n = hurt(n)
  if (n.level.traps.some((t) => same(t, n.p) && trapActive(t, n.elapsed))) n = hurt(n)
  return n
}

/** Star rating for a finished level: finish, all coins, and under the par time. */
export function parMs(l: Level): number {
  return 1500 + l.par * STEP_MS * 2.4 + l.coins.length * 700
}
export function stars(s: MState): 0 | 1 | 2 | 3 {
  if (s.status !== 'won') return 0
  return (1 + (s.level.coins.length === 0 || s.coinsGot === s.level.coins.length ? 1 : 0) + (s.elapsed <= parMs(s.level) ? 1 : 0)) as 1 | 2 | 3
}
export function score(s: MState): number {
  if (s.status !== 'won') return s.coinsGot * 10
  const bonus = Math.max(0, Math.round((parMs(s.level) - s.elapsed) / 100))
  return 100 + s.coinsGot * 10 + stars(s) * 50 + s.hearts * 20 + bonus
}
