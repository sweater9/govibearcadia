/**
 * Pure rules for Chinese Checkers: a 121-point star, ten men each, step to an adjacent hole or hop over any man
 * (as many hops in a row as you like). The first to fill the opposite point of the star wins. No React or browser APIs.
 *
 * Points use cube coordinates (x + y + z = 0). The star is two big triangles overlapping: every coordinate at least -4,
 * or every coordinate at most 4. A tip is a point where one coordinate is 5 or more in size.
 */
export type Pt = readonly [number, number, number]
export const MEN = 10
/** Total turns per player before the game is called and the furthest advanced player wins. */
export const TURN_LIMIT = 120

export const POINTS: readonly Pt[] = (() => {
  const out: Pt[] = []
  for (let z = -8; z <= 8; z++)
    for (let x = -8; x <= 8; x++) {
      const y = -x - z
      if ((x >= -4 && y >= -4 && z >= -4) || (x <= 4 && y <= 4 && z <= 4)) out.push([x, y, z])
    }
  return out
})()
export const N = POINTS.length

const key = (x: number, y: number, z: number) => `${x},${y},${z}`
const INDEX = new Map(POINTS.map((p, i) => [key(...p), i]))
export const DIRS: readonly Pt[] = [[1, -1, 0], [1, 0, -1], [0, 1, -1], [-1, 1, 0], [-1, 0, 1], [0, -1, 1]]
const at = (p: Pt, d: Pt, k: number) => INDEX.get(key(p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k))

/** Adjacent points, and the point two away in each direction (for hops). `step[i][d]` is -1 when off the board. */
export const STEP: readonly (readonly number[])[] = POINTS.map((p) => DIRS.map((d) => at(p, d, 1) ?? -1))
export const JUMP: readonly (readonly number[])[] = POINTS.map((p) => DIRS.map((d) => at(p, d, 2) ?? -1))

/** The six tips, in order around the star: x+, z-, y+, x-, z+, y-. Tip t is opposite tip (t + 3) % 6. */
const tipOf = (p: Pt): number => {
  const [x, y, z] = p
  if (x >= 5) return 0
  if (z <= -5) return 1
  if (y >= 5) return 2
  if (x <= -5) return 3
  if (z >= 5) return 4
  if (y <= -5) return 5
  return -1
}
export const TIP: readonly number[] = POINTS.map(tipOf)
export const tipPoints = (t: number): number[] => POINTS.flatMap((_, i) => (TIP[i] === t ? [i] : []))
/** The extreme point of a tip, which pieces head for. */
const APEX: readonly Pt[] = [[8, -4, -4], [4, 4, -8], [-4, 8, -4], [-8, 4, 4], [-4, -4, 8], [4, -8, 4]]
export const dist = (a: Pt, b: Pt) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))

export type Count = 2 | 3 | 4 | 6
export const COUNTS: readonly Count[] = [2, 3, 4, 6]
/** Which tip each player starts on, with the human (player 1) at the bottom of the screen, tip 4. */
const START_TIPS: Record<Count, number[]> = { 2: [4, 1], 3: [4, 0, 2], 4: [4, 5, 1, 2], 6: [4, 5, 0, 1, 2, 3] }

export type CState = {
  players: Count
  /** Owner of each point: 0 empty, 1..players. */
  cells: number[]
  turn: number
  winner: number
  /** Turns taken by each player (index 0 is player 1). */
  turns: number[]
  /** Set when the game was called at the turn limit rather than won by filling the goal. */
  called: boolean
  /** The last move, for highlighting. */
  last: { from: number; to: number } | null
  moves: number
}

export const startTip = (players: Count, p: number) => START_TIPS[players][p - 1]
export const goalTip = (players: Count, p: number) => (startTip(players, p) + 3) % 6

export function newGame(players: Count = 2): CState {
  const cells = Array<number>(N).fill(0)
  for (let p = 1; p <= players; p++) for (const i of tipPoints(startTip(players, p))) cells[i] = p
  return { players, cells, turn: 1, winner: 0, turns: Array(players).fill(0), called: false, last: null, moves: 0 }
}

export const isOver = (s: CState) => s.winner !== 0

/** Every point the man on `from` can reach this turn: one step, or a chain of hops. */
export function destinations(s: CState, from: number): number[] {
  if (s.cells[from] === 0) return []
  const out = new Set<number>()
  for (const to of STEP[from]) if (to >= 0 && s.cells[to] === 0) out.add(to)
  const seen = new Set<number>([from])
  const queue = [from]
  while (queue.length) {
    const cur = queue.pop()!
    for (let d = 0; d < 6; d++) {
      const over = STEP[cur][d]
      const land = JUMP[cur][d]
      if (over < 0 || land < 0 || s.cells[over] === 0 || (s.cells[land] !== 0 && land !== from) || seen.has(land)) continue
      seen.add(land)
      out.add(land)
      queue.push(land)
    }
  }
  out.delete(from)
  return [...out]
}

export type Move = { from: number; to: number }
export function legalMoves(s: CState): Move[] {
  if (isOver(s)) return []
  const out: Move[] = []
  s.cells.forEach((c, from) => {
    if (c === s.turn) for (const to of destinations(s, from)) out.push({ from, to })
  })
  return out
}

/** How far player `p` is from home: the total distance of the men to the goal apex. Lower is better. */
export function remaining(s: CState, p: number): number {
  const apex = APEX[goalTip(s.players, p)]
  let sum = 0
  s.cells.forEach((c, i) => {
    if (c === p) sum += dist(POINTS[i], apex)
  })
  return sum
}
const startRemaining = (players: Count, p: number) => {
  const apex = APEX[goalTip(players, p)]
  return tipPoints(startTip(players, p)).reduce((n, i) => n + dist(POINTS[i], apex), 0)
}
/** Percent of the way home, 0 to 100, for display and scoring. */
export function progress(s: CState, p: number): number {
  const goal = tipPoints(goalTip(s.players, p)).reduce((n, i) => n + dist(POINTS[i], APEX[goalTip(s.players, p)]), 0)
  const start = startRemaining(s.players, p)
  return Math.max(0, Math.min(100, Math.round((100 * (start - remaining(s, p))) / (start - goal))))
}

const inGoal = (s: CState, p: number) => tipPoints(goalTip(s.players, p)).every((i) => s.cells[i] === p)

/** Plays a move for the player to move. Returns the same object when illegal. */
export function move(s: CState, from: number, to: number): CState {
  if (isOver(s) || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= N || to >= N) return s
  if (s.cells[from] !== s.turn || !destinations(s, from).includes(to)) return s
  const cells = [...s.cells]
  cells[from] = 0
  cells[to] = s.turn
  const turns = [...s.turns]
  turns[s.turn - 1]++
  const next: CState = { ...s, cells, turns, last: { from, to }, moves: s.moves + 1 }
  if (inGoal(next, s.turn)) return { ...next, winner: s.turn }
  const turn = (s.turn % s.players) + 1
  if (turns.every((t) => t >= TURN_LIMIT)) {
    let best = 1
    for (let p = 2; p <= s.players; p++) if (progress(next, p) > progress(next, best)) best = p
    return { ...next, winner: best, called: true }
  }
  return { ...next, turn }
}

export function isState(v: unknown): v is CState {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Partial<CState>
  return (s.players === 2 || s.players === 3 || s.players === 4 || s.players === 6) && Array.isArray(s.cells) && s.cells.length === N &&
    s.cells.every((c) => Number.isInteger(c) && c >= 0 && c <= 6) && Number.isInteger(s.turn) && Number.isInteger(s.winner) &&
    Array.isArray(s.turns) && typeof s.called === 'boolean'
}

/** A win pays more the sooner it comes; otherwise the score is how far you got. */
export function scoreFor(s: CState): number {
  return s.winner === 1 ? 500 + Math.max(0, 400 - 3 * s.turns[0]) + (s.called ? 0 : 100) : progress(s, 1)
}

// ---- Computer player ----------------------------------------------------------------------------------------------

export type Level = 'easy' | 'normal' | 'hard'

/** Value of a position for player p: closer men, with a penalty for the man furthest behind. */
function value(s: CState, p: number): number {
  const apex = APEX[goalTip(s.players, p)]
  let sum = 0
  let worst = 0
  s.cells.forEach((c, i) => {
    if (c !== p) return
    const d = dist(POINTS[i], apex)
    sum += d
    worst = Math.max(worst, d)
  })
  return -(sum + 0.6 * worst)
}

/** The computer's move for whoever is to move. Easy picks among good moves at random; Hard looks at its own best follow-up. */
export function aiMove(s: CState, random: () => number, level: Level = 'normal'): Move | null {
  const moves = legalMoves(s)
  if (!moves.length) return null
  const p = s.turn
  const scored = moves.map((m) => {
    const c = [...s.cells]
    c[m.from] = 0
    c[m.to] = p
    const after: CState = { ...s, cells: c }
    let v = value(after, p)
    if (level === 'hard') {
      // Its best follow-up, as if the others did not move: prefers positions that open long hops.
      let top = v
      for (let from = 0; from < N; from++) {
        if (c[from] !== p) continue
        for (const to of destinations(after, from)) {
          const c2 = [...c]
          c2[from] = 0
          c2[to] = p
          top = Math.max(top, value({ ...s, cells: c2 }, p))
        }
      }
      v = v * 0.4 + top * 0.6
    }
    return { m, v }
  })
  scored.sort((a, b) => b.v - a.v)
  if (level === 'easy') {
    const pool = scored.slice(0, Math.min(8, scored.length))
    return pool[Math.floor(random() * pool.length)].m
  }
  const top = scored.filter((x) => x.v >= scored[0].v - 1e-9)
  return top[Math.floor(random() * top.length)].m
}
