import { createRandom } from '../../lib/rng'

export const DURATION = 45000
export const HOLES = 9
export type Kind = 'mole' | 'gold' | 'bomb'
export type Pop = { kind: Kind; ttl: number }
export type Status = 'ready' | 'playing' | 'over'
export type State = { seed: string; status: Status; t: number; holes: (Pop | null)[]; points: number; hits: number; misses: number; bombs: number; spawned: number; nextSpawn: number }

export const POINTS: Record<Kind, number> = { mole: 10, gold: 30, bomb: -25 }
export const newGame = (seed: string): State => ({ seed, status: 'ready', t: 0, holes: Array(HOLES).fill(null), points: 0, hits: 0, misses: 0, bombs: 0, spawned: 0, nextSpawn: 600 })
export const start = (s: State): State => (s.status === 'ready' ? { ...s, status: 'playing' } : s)
export const score = (s: State) => Math.max(0, s.points)
export const timeLeft = (s: State) => Math.max(0, DURATION - s.t)

/** Moles pop up faster and stay up for less time as the round goes on. */
export const ttlAt = (t: number) => Math.max(520, 1250 - t / 55)
export const gapAt = (t: number) => Math.max(300, 850 - t / 80)

export function step(s: State, ms: number): State {
  if (s.status !== 'playing') return s
  const t = Math.min(DURATION, s.t + ms)
  let { misses, spawned, nextSpawn } = s
  const holes = s.holes.map((h) => {
    if (!h) return null
    const ttl = h.ttl - ms
    if (ttl > 0) return { ...h, ttl }
    if (h.kind !== 'bomb') misses++
    return null
  })
  while (nextSpawn <= t && nextSpawn < DURATION) {
    const rnd = createRandom(`${s.seed}:spawn:${spawned}`)
    const free = holes.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0)
    spawned++
    if (free.length) {
      const roll = rnd()
      const kind: Kind = roll < 0.16 ? 'bomb' : roll < 0.28 ? 'gold' : 'mole'
      holes[free[Math.floor(rnd() * free.length)]] = { kind, ttl: ttlAt(nextSpawn) * (kind === 'gold' ? 0.8 : 1) }
    }
    nextSpawn += gapAt(nextSpawn)
  }
  return { ...s, t, holes, misses, spawned, nextSpawn, status: t >= DURATION ? 'over' : 'playing' }
}

export function whack(s: State, i: number): State {
  if (s.status === 'over') return s
  const ready = start(s)
  const h = ready.holes[i]
  if (!h) return ready
  const holes = ready.holes.slice()
  holes[i] = null
  return { ...ready, holes, points: ready.points + POINTS[h.kind], hits: ready.hits + (h.kind === 'bomb' ? 0 : 1), bombs: ready.bombs + (h.kind === 'bomb' ? 1 : 0) }
}
