import type { Random } from '../../lib/rng'

/**
 * Pure rules for Nine Men's Morris: 24 points on three nested squares. Each player places nine men, then slides them
 * along the lines. Three in a row (a mill) removes an opponent man that is not in a mill, unless all of theirs are.
 * A player down to three men may fly to any empty point. Fewer than three men, or no legal move, loses.
 * No React or browser APIs, so the server can validate every move.
 *
 * Points are numbered 0 to 23: ring r (0 outer, 1 middle, 2 inner) holds 8r..8r+7, clockwise from the top-left
 * corner. Even offsets are corners, odd offsets are the midpoints of a side.
 */

export type Player = 1 | 2
export const POINTS = 24
export const MEN = 9
export type Cell = 0 | Player

export type MState = {
  cells: Cell[]
  /** Men each player still has to place. */
  hand: [number, number]
  turn: Player
  /** True while `turn` has just made a mill and must now remove a man. */
  removing: boolean
  winner: 0 | Player
  draw: boolean
  /** Plies played (placing, sliding and removing each count). */
  moves: number
  /** Plies since a man was placed or removed. */
  quiet: number
}

/** Plies without a placement or a removal before the game is a draw. */
export const QUIET_LIMIT = 60

const at = (ring: number, i: number) => ring * 8 + ((i + 8) % 8)

export const MILLS: readonly (readonly [number, number, number])[] = [
  ...[0, 1, 2].flatMap((r) => [0, 2, 4, 6].map((s) => [at(r, s), at(r, s + 1), at(r, s + 2)] as const)),
  ...[1, 3, 5, 7].map((k) => [k, 8 + k, 16 + k] as const),
]

export const NEIGHBOURS: readonly (readonly number[])[] = Array.from({ length: POINTS }, (_, p) => {
  const ring = Math.floor(p / 8)
  const i = p % 8
  const n = [at(ring, i - 1), at(ring, i + 1)]
  if (i % 2 === 1) {
    if (ring > 0) n.push(p - 8)
    if (ring < 2) n.push(p + 8)
  }
  return n
})

export const other = (p: Player): Player => (p === 1 ? 2 : 1)
const idx = (p: Player) => p - 1

export function newGame(): MState {
  return { cells: Array<Cell>(POINTS).fill(0), hand: [MEN, MEN], turn: 1, removing: false, winner: 0, draw: false, moves: 0, quiet: 0 }
}

export const isOver = (s: MState) => s.winner !== 0 || s.draw
export const onBoard = (s: MState, p: Player) => s.cells.filter((c) => c === p).length
export const menLeft = (s: MState, p: Player) => onBoard(s, p) + s.hand[idx(p)]
export const inMill = (cells: readonly Cell[], point: number) => {
  const c = cells[point]
  return c !== 0 && MILLS.some((m) => m.includes(point) && m.every((q) => cells[q] === c))
}
/** A player flies once down to three men, with nothing left to place. */
export const flying = (s: MState, p: Player) => s.hand[idx(p)] === 0 && onBoard(s, p) === 3

export type Phase = 'place' | 'move' | 'remove'
export const phase = (s: MState): Phase => (s.removing ? 'remove' : s.hand[idx(s.turn)] > 0 ? 'place' : 'move')

/** Men the player to move may remove: those outside a mill, or every man if all of them are in mills. */
export function removable(s: MState): number[] {
  const foe = other(s.turn)
  const all = s.cells.flatMap((c, i) => (c === foe ? [i] : []))
  const loose = all.filter((i) => !inMill(s.cells, i))
  return loose.length ? loose : all
}

export type Ply = { type: 'place'; to: number } | { type: 'slide'; from: number; to: number } | { type: 'remove'; at: number }

export function legalPlies(s: MState): Ply[] {
  if (isOver(s)) return []
  if (s.removing) return removable(s).map((a) => ({ type: 'remove', at: a }))
  if (s.hand[idx(s.turn)] > 0) return s.cells.flatMap((c, i) => (c === 0 ? [{ type: 'place', to: i } as Ply] : []))
  const fly = flying(s, s.turn)
  const out: Ply[] = []
  s.cells.forEach((c, from) => {
    if (c !== s.turn) return
    const dests = fly ? s.cells.flatMap((d, i) => (d === 0 ? [i] : [])) : NEIGHBOURS[from].filter((i) => s.cells[i] === 0)
    for (const to of dests) out.push({ type: 'slide', from, to })
  })
  return out
}

/** The player who has just finished a turn may have won: the other has too few men or cannot move. */
function settle(s: MState): MState {
  const foe = other(s.turn)
  if (menLeft(s, foe) < 3) return { ...s, winner: s.turn }
  const next = { ...s, turn: foe }
  if (phase(next) === 'move' && legalPlies(next).length === 0) return { ...s, winner: s.turn }
  if (s.quiet >= QUIET_LIMIT) return { ...s, draw: true }
  return next
}

/** Applies a ply for the player to move. Returns the same object when it is illegal. */
export function apply(s: MState, ply: Ply): MState {
  if (isOver(s)) return s
  const cells = [...s.cells]
  const moves = s.moves + 1
  if (ply.type === 'remove') {
    if (!s.removing || !removable(s).includes(ply.at)) return s
    cells[ply.at] = 0
    return settle({ ...s, cells, removing: false, moves, quiet: 0 })
  }
  if (s.removing) return s
  if (ply.type === 'place') {
    if (s.hand[idx(s.turn)] === 0 || !Number.isInteger(ply.to) || cells[ply.to] !== 0) return s
    cells[ply.to] = s.turn
    const hand: [number, number] = [...s.hand]
    hand[idx(s.turn)]--
    const next = { ...s, cells, hand, moves, quiet: 0 }
    return inMill(cells, ply.to) ? { ...next, removing: true } : settle(next)
  }
  if (s.hand[idx(s.turn)] > 0 || cells[ply.from] !== s.turn || cells[ply.to] !== 0) return s
  if (!flying(s, s.turn) && !NEIGHBOURS[ply.from].includes(ply.to)) return s
  cells[ply.from] = 0
  cells[ply.to] = s.turn
  const next = { ...s, cells, moves, quiet: s.quiet + 1 }
  return inMill(cells, ply.to) ? { ...next, removing: true } : settle(next)
}

/** Turns a client message ({type: 'move', to} | {from, to} | {at}) into a ply, or null when it is malformed. */
export function plyFromMessage(s: MState, m: Record<string, unknown>): Ply | null {
  const pt = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < POINTS ? v : null)
  if (s.removing) {
    const a = pt(m.at)
    return a === null ? null : { type: 'remove', at: a }
  }
  const to = pt(m.to)
  if (to === null) return null
  if (s.hand[idx(s.turn)] > 0) return { type: 'place', to }
  const from = pt(m.from)
  return from === null ? null : { type: 'slide', from, to }
}

export function play(s: MState, m: Record<string, unknown>): MState {
  const ply = plyFromMessage(s, m)
  return ply ? apply(s, ply) : s
}

export function isState(v: unknown): v is MState {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Partial<MState>
  const hand = s.hand
  return (
    Array.isArray(s.cells) && s.cells.length === POINTS && s.cells.every((c) => c === 0 || c === 1 || c === 2) &&
    Array.isArray(hand) && hand.length === 2 && hand.every((n) => Number.isInteger(n) && n >= 0 && n <= MEN) &&
    (s.turn === 1 || s.turn === 2) && typeof s.removing === 'boolean' &&
    (s.winner === 0 || s.winner === 1 || s.winner === 2) && typeof s.draw === 'boolean' &&
    typeof s.moves === 'number' && typeof s.quiet === 'number'
  )
}

/** Wins pay more the more men survive and the sooner they come. */
export function scoreFor(s: MState): number {
  if (s.winner === 1) return 400 + 60 * menLeft(s, 1) + Math.max(0, 200 - s.moves)
  return s.draw ? 150 : 0
}

// ---- Computer player ----------------------------------------------------------------------------------------------

export type Level = 'easy' | 'normal' | 'hard'
export const DEPTH: Record<Level, number> = { easy: 1, normal: 3, hard: 5 }

/** Static value for `me`: men, men in hand, mobility, and men that are blocked. */
function evaluate(s: MState, me: Player): number {
  const foe = other(me)
  if (s.winner) return s.winner === me ? 10_000 : -10_000
  if (s.draw) return 0
  const mobility = (p: Player) => s.cells.reduce<number>((n, c, i) => n + (c === p ? NEIGHBOURS[i].filter((j) => s.cells[j] === 0).length : 0), 0)
  const mills = (p: Player) => MILLS.filter((m) => m.every((q) => s.cells[q] === p)).length
  const twos = (p: Player) => MILLS.filter((m) => m.filter((q) => s.cells[q] === p).length === 2 && m.some((q) => s.cells[q] === 0)).length
  return 100 * (menLeft(s, me) - menLeft(s, foe)) + 8 * (mills(me) - mills(foe)) + 6 * (twos(me) - twos(foe)) + 2 * (mobility(me) - mobility(foe))
}

function search(s: MState, me: Player, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || isOver(s)) return evaluate(s, me) * (1 + depth / 100)
  const plies = legalPlies(s)
  if (s.turn === me) {
    let best = -Infinity
    for (const p of plies) {
      best = Math.max(best, search(apply(s, p), me, depth - 1, alpha, beta))
      alpha = Math.max(alpha, best)
      if (alpha >= beta) break
    }
    return best
  }
  let best = Infinity
  for (const p of plies) {
    best = Math.min(best, search(apply(s, p), me, depth - 1, alpha, beta))
    beta = Math.min(beta, best)
    if (alpha >= beta) break
  }
  return best
}

/** The computer's next ply for whoever is to move. Easy looks one ply ahead and sometimes plays at random. */
export function aiPly(s: MState, random: Random, level: Level = 'normal'): Ply | null {
  const plies = legalPlies(s)
  if (!plies.length) return null
  if (level === 'easy' && random() < 0.3) return plies[Math.floor(random() * plies.length)]
  const me = s.turn
  let best = -Infinity
  let pool: Ply[] = []
  for (const p of plies) {
    const v = search(apply(s, p), me, DEPTH[level] - 1, -Infinity, Infinity)
    if (v > best + 1e-9) {
      best = v
      pool = [p]
    } else if (Math.abs(v - best) <= 1e-9) pool.push(p)
  }
  return pool[Math.floor(random() * pool.length)]
}

/** What a click on point `p` means for the player `me` who is to move: place, pick, slide, remove, or drop the pick. */
export function interact(s: MState, me: Player, picked: number | null, p: number): { ply: Ply | null; select: number | null } {
  if (isOver(s) || s.turn !== me) return { ply: null, select: null }
  const ph = phase(s)
  if (ph === 'remove') return { ply: removable(s).includes(p) ? { type: 'remove', at: p } : null, select: null }
  if (ph === 'place') return { ply: s.cells[p] === 0 ? { type: 'place', to: p } : null, select: null }
  if (s.cells[p] === me) return { ply: null, select: picked === p ? null : p }
  if (picked !== null && s.cells[p] === 0 && legalPlies(s).some((m) => m.type === 'slide' && m.from === picked && m.to === p)) return { ply: { type: 'slide', from: picked, to: p }, select: null }
  return { ply: null, select: picked }
}

/** Points the picked man may move to. */
export const slideTargets = (s: MState, picked: number | null): Set<number> =>
  new Set(picked === null || phase(s) !== 'move' ? [] : legalPlies(s).flatMap((m) => (m.type === 'slide' && m.from === picked ? [m.to] : [])))

/** Every point that is part of a mill. */
export const millPoints = (cells: readonly Cell[]): Set<number> => {
  const out = new Set<number>()
  for (const m of MILLS) if (cells[m[0]] !== 0 && m.every((q) => cells[q] === cells[m[0]])) m.forEach((q) => out.add(q))
  return out
}
