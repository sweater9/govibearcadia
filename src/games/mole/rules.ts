import { createRandom } from '../../lib/rng'

export const DURATION = 45000
export const HOLES = 9
export const LIVES = 3
/** How long one target colour stays before it changes. */
export const SWITCH_MS = 6000
/** Every this many hits in a row raises the multiplier by one, up to MAX_MULTIPLIER. */
export const STREAK_STEP = 5
export const MAX_MULTIPLIER = 4

export type Kind = 'mole' | 'gold' | 'bomb'
export const COLOURS = ['red', 'blue', 'green'] as const
export type Colour = (typeof COLOURS)[number]
export type Pop = { kind: Kind; colour: Colour; ttl: number }
export type Status = 'ready' | 'playing' | 'over'
export type Reason = 'time' | 'lives'
export type State = {
  seed: string
  status: Status
  t: number
  holes: (Pop | null)[]
  points: number
  hits: number
  misses: number
  bombs: number
  wrong: number
  lives: number
  streak: number
  bestStreak: number
  target: Colour
  switches: number
  nextSwitch: number
  spawned: number
  nextSpawn: number
  reason?: Reason
}

export const POINTS: Record<Kind, number> = { mole: 10, gold: 30, bomb: -25 }
export const BOMB_PENALTY = POINTS.bomb
export const WRONG_PENALTY = -10

export const targetFor = (seed: string, n: number, previous?: Colour): Colour => {
  const pool = COLOURS.filter((c) => c !== previous)
  return pool[Math.floor(createRandom(`${seed}:target:${n}`)() * pool.length)]
}

export const newGame = (seed: string): State => ({
  seed, status: 'ready', t: 0, holes: Array(HOLES).fill(null), points: 0, hits: 0, misses: 0, bombs: 0, wrong: 0,
  lives: LIVES, streak: 0, bestStreak: 0, target: targetFor(seed, 0), switches: 0, nextSwitch: SWITCH_MS, spawned: 0, nextSpawn: 600,
})
export const start = (s: State): State => (s.status === 'ready' ? { ...s, status: 'playing' } : s)
export const score = (s: State) => Math.max(0, s.points)
export const timeLeft = (s: State) => Math.max(0, DURATION - s.t)
export const multiplier = (streak: number) => Math.min(MAX_MULTIPLIER, 1 + Math.floor(streak / STREAK_STEP))
/** Seconds until the target colour changes (for the countdown bar). */
export const switchIn = (s: State) => Math.max(0, s.nextSwitch - s.t)

/** Moles pop up faster and stay up for less time as the round goes on. */
export const ttlAt = (t: number) => Math.max(520, 1250 - t / 55)
export const gapAt = (t: number) => Math.max(300, 850 - t / 80)

export function step(s: State, ms: number): State {
  if (s.status !== 'playing') return s
  const t = Math.min(DURATION, s.t + ms)
  let { misses, spawned, nextSpawn, target, switches, nextSwitch, streak } = s
  const holes = s.holes.map((h) => {
    if (!h) return null
    const ttl = h.ttl - ms
    if (ttl > 0) return { ...h, ttl }
    if (h.kind !== 'bomb') {
      misses++
      // Letting a mole of the target colour escape breaks the streak; a wrong-colour one escaping is fine.
      if (h.colour === target) streak = 0
    }
    return null
  })
  while (nextSwitch <= t && nextSwitch < DURATION) {
    switches++
    target = targetFor(s.seed, switches, target)
    nextSwitch += SWITCH_MS
  }
  while (nextSpawn <= t && nextSpawn < DURATION) {
    const rnd = createRandom(`${s.seed}:spawn:${spawned}`)
    const free = holes.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0)
    spawned++
    if (free.length) {
      const roll = rnd()
      const kind: Kind = roll < 0.14 ? 'bomb' : roll < 0.26 ? 'gold' : 'mole'
      // About half of all moles are in the colour to hit, so there is always something to whack.
      const others = COLOURS.filter((c) => c !== target)
      const colour: Colour = rnd() < 0.5 ? target : others[Math.floor(rnd() * others.length)]
      holes[free[Math.floor(rnd() * free.length)]] = { kind, colour, ttl: ttlAt(nextSpawn) * (kind === 'gold' ? 0.8 : 1) }
    }
    nextSpawn += gapAt(nextSpawn)
  }
  const over = t >= DURATION
  return { ...s, t, holes, misses, spawned, nextSpawn, target, switches, nextSwitch, streak, status: over ? 'over' : 'playing', reason: over ? 'time' : undefined }
}

const lose = (s: State, lives: number): Pick<State, 'lives' | 'status' | 'reason'> =>
  lives <= 0 ? { lives: 0, status: 'over', reason: 'lives' } : { lives, status: s.status, reason: s.reason }

export function whack(s: State, i: number): State {
  if (s.status === 'over') return s
  const ready = start(s)
  const h = ready.holes[i]
  if (!h) return ready
  const holes = ready.holes.slice()
  holes[i] = null
  if (h.kind === 'bomb') return { ...ready, holes, points: ready.points + BOMB_PENALTY, bombs: ready.bombs + 1, streak: 0, ...lose(ready, ready.lives - 1) }
  if (h.colour !== ready.target) return { ...ready, holes, points: ready.points + WRONG_PENALTY, wrong: ready.wrong + 1, streak: 0, ...lose(ready, ready.lives - 1) }
  const streak = ready.streak + 1
  // The multiplier that applies is the one the streak had before this hit, so the sixth hit in a row is the first at x2 (the multiplier shown is the one the next hit gets).
  const gained = POINTS[h.kind] * multiplier(ready.streak)
  return { ...ready, holes, points: ready.points + gained, hits: ready.hits + 1, streak, bestStreak: Math.max(ready.bestStreak, streak) }
}
