import type { Random } from '../../lib/rng'

/**
 * Pure rules for English/American checkers (8x8, men move forward, kings both ways, captures are mandatory and
 * chain, a man that reaches the far row becomes a king and its move ends). No React or browser APIs.
 */

export const SIZE = 8
export type Player = 1 | 2
/** 0 empty, 1/2 a man of that player, 3/4 a king of player 1/2. */
export type Cell = 0 | 1 | 2 | 3 | 4
export type Step = { from: number; to: number; captured: number | null }

/** Player 1 starts at the bottom (rows 5 to 7), moves first and is the human in single-player. */
export type CState = {
  cells: Cell[]
  turn: Player
  winner: 0 | Player
  /** When a capture can continue, the square of the piece that must keep jumping. */
  chain: number | null
  /** Number of single steps taken (each hop of a multi-capture counts). */
  moves: number
  /** Plies since the last capture or man move. */
  quiet: number
  draw: boolean
}

/** Plies without a capture or a man move before the game is declared a draw. */
export const QUIET_LIMIT = 80

export const row = (i: number) => Math.floor(i / SIZE)
export const col = (i: number) => i % SIZE
export const sq = (r: number, c: number) => r * SIZE + c
export const isDark = (i: number) => (row(i) + col(i)) % 2 === 1
export const ownerOf = (c: Cell): 0 | Player => (c === 0 ? 0 : c % 2 === 1 ? 1 : 2)
export const isKing = (c: Cell) => c >= 3
export const other = (p: Player): Player => (p === 1 ? 2 : 1)
export const isOver = (s: CState) => s.winner !== 0 || s.draw

export function newGame(): CState {
  const cells = Array<Cell>(SIZE * SIZE).fill(0)
  for (let i = 0; i < cells.length; i++) {
    if (!isDark(i)) continue
    if (row(i) < 3) cells[i] = 2
    else if (row(i) > 4) cells[i] = 1
  }
  return { cells, turn: 1, winner: 0, chain: null, moves: 0, quiet: 0, draw: false }
}

const dirsFor = (c: Cell): [number, number][] => {
  if (isKing(c)) return [[-1, -1], [-1, 1], [1, -1], [1, 1]]
  return ownerOf(c) === 1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]
}
const inside = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE

function jumpsFrom(cells: readonly Cell[], i: number): Step[] {
  const piece = cells[i]
  const out: Step[] = []
  for (const [dr, dc] of dirsFor(piece)) {
    const mr = row(i) + dr
    const mc = col(i) + dc
    const lr = mr + dr
    const lc = mc + dc
    if (!inside(lr, lc)) continue
    const mid = cells[sq(mr, mc)]
    if (mid !== 0 && ownerOf(mid) !== ownerOf(piece) && cells[sq(lr, lc)] === 0) out.push({ from: i, to: sq(lr, lc), captured: sq(mr, mc) })
  }
  return out
}

function slidesFrom(cells: readonly Cell[], i: number): Step[] {
  const out: Step[] = []
  for (const [dr, dc] of dirsFor(cells[i])) {
    const r = row(i) + dr
    const c = col(i) + dc
    if (inside(r, c) && cells[sq(r, c)] === 0) out.push({ from: i, to: sq(r, c), captured: null })
  }
  return out
}

/** Every legal single step for the player to move. If any capture exists, only captures are legal. */
export function legalSteps(s: CState): Step[] {
  if (isOver(s)) return []
  const mine = s.chain !== null ? [s.chain] : s.cells.flatMap((c, i) => (ownerOf(c) === s.turn ? [i] : []))
  const jumps = mine.flatMap((i) => jumpsFrom(s.cells, i))
  if (jumps.length || s.chain !== null) return jumps
  return mine.flatMap((i) => slidesFrom(s.cells, i))
}

/** Performs one step (a slide, or one hop of a capture). Returns the same object when it is not legal. */
export function step(s: CState, from: unknown, to: unknown): CState {
  if (typeof from !== 'number' || typeof to !== 'number') return s
  const move = legalSteps(s).find((m) => m.from === from && m.to === to)
  if (!move) return s
  const cells = s.cells.slice()
  const piece = cells[from]
  cells[from] = 0
  if (move.captured !== null) cells[move.captured] = 0
  const promote = !isKing(piece) && row(to) === (s.turn === 1 ? 0 : SIZE - 1)
  cells[to] = promote ? ((piece + 2) as Cell) : piece
  const moves = s.moves + 1
  const quiet = move.captured !== null || !isKing(piece) ? 0 : s.quiet + 1
  // A capture continues while the same piece can jump again; promotion ends the move.
  if (move.captured !== null && !promote && jumpsFrom(cells, to).length) return { ...s, cells, chain: to, moves, quiet }
  const next: CState = { cells, turn: other(s.turn), winner: 0, chain: null, moves, quiet, draw: false }
  if (legalSteps(next).length === 0) return { ...next, winner: s.turn }
  if (quiet >= QUIET_LIMIT) return { ...next, draw: true }
  return next
}

const MAN = 100
const KING = 160

function evaluate(s: CState, me: Player): number {
  let v = 0
  for (let i = 0; i < s.cells.length; i++) {
    const c = s.cells[i]
    if (c === 0) continue
    const owner = ownerOf(c)
    let val = isKing(c) ? KING : MAN
    if (!isKing(c)) val += 3 * (owner === 1 ? SIZE - 1 - row(i) : row(i)) // advancement
    val += 2 - Math.abs(col(i) - 3.5) * 0.5 // prefer the middle
    v += owner === me ? val : -val
  }
  return v
}

function search(s: CState, depth: number, alpha: number, beta: number, me: Player): number {
  if (s.winner) return s.winner === me ? 100000 + depth : -100000 - depth
  if (s.draw) return 0
  if (depth === 0) return evaluate(s, me)
  const maximizing = s.turn === me
  let best = maximizing ? -Infinity : Infinity
  for (const m of legalSteps(s)) {
    // A forced chain does not use up search depth: it is one move.
    const next = step(s, m.from, m.to)
    const v = search(next, next.turn === s.turn ? depth : depth - 1, alpha, beta, me)
    if (maximizing) {
      best = Math.max(best, v)
      alpha = Math.max(alpha, best)
    } else {
      best = Math.min(best, v)
      beta = Math.min(beta, best)
    }
    if (alpha >= beta) break
  }
  return best
}

/**
 * The computer's next step, or null when it has none. Looks `depth` moves ahead; equally good steps are chosen
 * with `random`, so the same seed always plays the same game.
 */
export function aiStep(s: CState, random: Random = Math.random, depth = 4): Step | null {
  const steps = legalSteps(s)
  if (!steps.length) return null
  const me = s.turn
  let best = -Infinity
  let choices: Step[] = []
  for (const m of steps) {
    const next = step(s, m.from, m.to)
    const v = search(next, next.turn === s.turn ? depth : depth - 1, -Infinity, Infinity, me)
    if (v > best) {
      best = v
      choices = [m]
    } else if (v === best) choices.push(m)
  }
  return choices[Math.floor(random() * choices.length)]
}

/** A win is worth more the sooner it comes; a draw is worth something; a loss nothing. */
export function scoreFor(s: CState): number {
  if (s.winner === 1) return Math.max(400, 1000 - 4 * s.moves)
  return s.draw ? 300 : 0
}

export function isState(v: unknown): v is CState {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Partial<CState>
  return (
    Array.isArray(s.cells) && s.cells.length === 64 && s.cells.every((c) => Number.isInteger(c) && c >= 0 && c <= 4) &&
    (s.turn === 1 || s.turn === 2) && (s.winner === 0 || s.winner === 1 || s.winner === 2) &&
    (s.chain === null || (typeof s.chain === 'number' && s.chain >= 0 && s.chain < 64)) &&
    typeof s.moves === 'number' && typeof s.quiet === 'number' && typeof s.draw === 'boolean'
  )
}

/**
 * What a click on square `i` means for the player `me`: pick a piece, move the picked piece, or drop the pick.
 * During a multi-capture the jumping piece stays picked. Pure, so the single-player and online boards agree.
 */
export function interact(s: CState, me: Player, selected: number | null, i: number): { select: number | null; move?: { from: number; to: number } } {
  if (isOver(s) || s.turn !== me) return { select: null }
  const steps = legalSteps(s)
  const keep = s.chain
  if (selected !== null && steps.some((m) => m.from === selected && m.to === i)) return { select: null, move: { from: selected, to: i } }
  if (steps.some((m) => m.from === i)) return { select: i }
  return { select: keep }
}
