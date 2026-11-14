import { createRandom } from '../../lib/rng'

export const COLS = 7
/** If you stop making progress for this long, the eagle gets you. */
export const IDLE_LIMIT = 7000
export type Kind = 'grass' | 'road'
export type Row = { kind: Kind; trees: number[]; dir: 1 | -1; speed: number; period: number; length: number; phase: number }
export type Car = { x: number; length: number }
export type Status = 'ready' | 'playing' | 'dead'
export type Cause = 'car' | 'eagle' | null
export type State = { seed: string; status: Status; row: number; col: number; best: number; t: number; idle: number; cause: Cause }

/** Row 0 and 1 are always grass so you can find your feet; after that the world is dealt from the seed, one row at a time. */
export function rowAt(seed: string, r: number): Row {
  const rnd = createRandom(`${seed}:row:${r}`)
  const road = r > 1 && rnd() < 0.62 + Math.min(0.15, r * 0.004)
  if (!road) {
    const trees: number[] = []
    if (r > 1) { const n = Math.floor(rnd() * 3); while (trees.length < n) { const c = Math.floor(rnd() * COLS); if (!trees.includes(c)) trees.push(c) } }
    return { kind: 'grass', trees, dir: 1, speed: 0, period: 1, length: 1, phase: 0 }
  }
  const dir: 1 | -1 = rnd() < 0.5 ? 1 : -1
  const speed = 1.1 + rnd() * 1.5 + Math.min(1.4, r * 0.025)
  const length = rnd() < 0.3 ? 2 : 1
  const period = length + 2.6 + rnd() * 2.2
  return { kind: 'road', trees: [], dir, speed, period, length, phase: rnd() * period }
}

/** Cars in a road row at time `t` (ms), with x measured in cells from the left edge. Cars repeat every `period` cells and wrap around. */
export function carsAt(row: Row, t: number): Car[] {
  if (row.kind !== 'road') return []
  const shift = row.phase + row.dir * row.speed * (t / 1000)
  const cars: Car[] = []
  const start = Math.floor((-row.length - shift) / row.period) - 1
  for (let k = start; k < start + Math.ceil((COLS + row.length) / row.period) + 3; k++) {
    const x = k * row.period + shift
    if (x + row.length > -1 && x < COLS + 1) cars.push({ x, length: row.length })
  }
  return cars
}

const hitsCar = (cars: Car[], col: number) => cars.some((c) => c.x < col + 1 - 0.2 && c.x + c.length > col + 0.2)

export const newGame = (seed: string): State => ({ seed, status: 'ready', row: 0, col: 3, best: 0, t: 0, idle: 0, cause: null })
export const start = (s: State): State => (s.status === 'ready' ? { ...s, status: 'playing' } : s)
export const score = (s: State) => s.best

export type Dir = 'up' | 'down' | 'left' | 'right'
export function hop(s: State, dir: Dir): State {
  if (s.status === 'dead') return s
  let { row, col } = s
  if (dir === 'up') row++
  else if (dir === 'down') row--
  else if (dir === 'left') col--
  else col++
  if (row < 0 || row < s.best - 2 || col < 0 || col >= COLS) return start(s)
  if (rowAt(s.seed, row).trees.includes(col)) return start(s)
  const best = Math.max(s.best, row)
  const next: State = { ...start(s), row, col, best, idle: best > s.best ? 0 : s.idle }
  return hitsCar(carsAt(rowAt(s.seed, row), s.t), col) ? { ...next, status: 'dead', cause: 'car' } : next
}

export function step(s: State, ms: number): State {
  if (s.status !== 'playing') return s
  const t = s.t + ms
  const idle = s.idle + ms
  if (idle >= IDLE_LIMIT) return { ...s, t, idle, status: 'dead', cause: 'eagle' }
  const next = { ...s, t, idle }
  return hitsCar(carsAt(rowAt(s.seed, s.row), t), s.col) ? { ...next, status: 'dead', cause: 'car' } : next
}
