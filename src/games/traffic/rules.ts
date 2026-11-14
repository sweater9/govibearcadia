import { createRandom } from '../../lib/rng'

export const LANES = 4
/** Everything is measured in percent of the field height (0 top, 100 bottom). */
export const CAR_H = 13
export const PLAYER_TOP = 82
const ROW_GAP = 40
const MAX_STEP_MS = 20

export type Car = { id: number; lane: number; y: number }
export type Status = 'ready' | 'playing' | 'crashed'
export type State = {
  seed: string
  status: Status
  lane: number
  cars: Car[]
  /** Metres driven. */
  distance: number
  /** Cars that went past the player. */
  passed: number
  /** Rows of traffic spawned so far; also the index used to deal the next row. */
  rows: number
  /** Distance the lead row has travelled since the last spawn, in field percent. */
  sinceSpawn: number
  nextId: number
}

/** Field percent per second; starts gentle and keeps climbing. */
export const speedAt = (distance: number) => Math.min(95, 38 + distance / 18)

export const newGame = (seed: string): State => ({ seed, status: 'ready', lane: 1, cars: [], distance: 0, passed: 0, rows: 0, sinceSpawn: ROW_GAP, nextId: 1 })

export const start = (s: State): State => (s.status === 'ready' ? { ...s, status: 'playing' } : s)

export function move(s: State, dir: -1 | 1): State {
  if (s.status === 'crashed') return s
  const lane = Math.max(0, Math.min(LANES - 1, s.lane + dir))
  return lane === s.lane ? s : { ...s, lane, status: 'playing' }
}

export const score = (s: State) => Math.floor(s.distance) + s.passed * 10

const hits = (s: State) => s.cars.some((c) => c.lane === s.lane && c.y + CAR_H > PLAYER_TOP + 2 && c.y < PLAYER_TOP + CAR_H - 2)

/** One row of traffic: one car most of the time, two sometimes, never every lane, so there is always a gap. */
export function dealRow(seed: string, row: number): number[] {
  const random = createRandom(`${seed}:row:${row}`)
  const count = random() < 0.65 ? 1 : 2
  const lanes: number[] = []
  while (lanes.length < count) {
    const lane = Math.floor(random() * LANES)
    if (!lanes.includes(lane)) lanes.push(lane)
  }
  return lanes
}

function tick(s: State, ms: number): State {
  const speed = speedAt(s.distance)
  const dy = (speed * ms) / 1000
  let cars = s.cars.map((c) => ({ ...c, y: c.y + dy }))
  const gone = cars.filter((c) => c.y > 100).length
  cars = cars.filter((c) => c.y <= 100)
  let { rows, sinceSpawn, nextId } = s
  sinceSpawn += dy
  if (sinceSpawn >= ROW_GAP) {
    sinceSpawn -= ROW_GAP
    for (const lane of dealRow(s.seed, rows)) cars.push({ id: nextId++, lane, y: -CAR_H - sinceSpawn })
    rows++
  }
  const next: State = { ...s, cars, rows, sinceSpawn, nextId, distance: s.distance + (speed * ms) / 1000 / 2, passed: s.passed + gone }
  return hits(next) ? { ...next, status: 'crashed' } : next
}

/** Advance the game by `ms`, in small steps so a fast car cannot skip through the player. */
export function step(s: State, ms: number): State {
  if (s.status !== 'playing') return s
  let cur = s
  let left = ms
  while (left > 0 && cur.status === 'playing') {
    const part = Math.min(MAX_STEP_MS, left)
    cur = tick(cur, part)
    left -= part
  }
  return cur
}
