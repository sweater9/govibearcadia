import type { Random } from '../../lib/rng'
import { BISHOP, GOLD, KING, KNIGHT, LANCE, PAWN, ROOK, SILVER, inCheckCells, kindOf, legalMoves, ownerOf, pseudoCaptures, stepRaw, type GState, type Move, type Owner } from './rules'

export type Level = 'easy' | 'normal' | 'hard'
/** Search depth and the most positions looked at per move, so the reply is always quick and the same every time. */
export const SETTINGS: Record<Level, { depth: number; nodes: number }> = {
  easy: { depth: 1, nodes: 2_000 },
  normal: { depth: 2, nodes: 6_000 },
  hard: { depth: 3, nodes: 9_000 },
}

const MATE = 100_000
/** Material in hundredths of a pawn, by kind (promoted kinds are kind + 8). */
const VALUE: Record<number, number> = { 1: 100, 2: 300, 3: 400, 4: 500, 5: 600, 6: 800, 7: 1000, 8: 0, 9: 600, 10: 600, 11: 600, 12: 600, 14: 1100, 15: 1300 }
const HAND_VALUE = (k: number) => Math.round(VALUE[k] * 1.1)

/** Static value for the player to move: material, men in hand, advancement, and a king that stays home. */
export function evaluate(s: GState): number {
  let v = 0
  for (let i = 0; i < 81; i++) {
    const c = s.cells[i]
    if (!c) continue
    const o = ownerOf(c) as Owner
    const k = kindOf(c)
    const row = (i / 9) | 0
    const adv = o === 1 ? 8 - row : row
    const col = i % 9
    const centre = 4 - Math.abs(col - 4)
    let x = VALUE[k]
    if (k === PAWN) x += 4 * adv
    else if (k === KING) x -= 6 * adv
    else if (k === SILVER || k === KNIGHT || k === GOLD || k === LANCE) x += 2 * adv + centre
    else if (k === BISHOP || k === ROOK) x += adv + centre
    v += o === s.turn ? x : -x
  }
  for (const k of [PAWN, LANCE, KNIGHT, SILVER, GOLD, BISHOP, ROOK]) {
    v += HAND_VALUE(k) * (s.hand[s.turn - 1][k - 1] - s.hand[2 - s.turn][k - 1])
  }
  return v
}

const gain = (s: GState, m: Move) => {
  if (m.drop) return 0
  const cap = s.cells[m.to]
  return (cap ? VALUE[kindOf(cap)] * 10 - VALUE[kindOf(s.cells[m.from])] : 0) + (m.promote ? 300 : 0)
}
const ordered = (s: GState, ms: Move[]) => [...ms].sort((a, b) => gain(s, b) - gain(s, a))

type Budget = { left: number }

/** Quiet-position extension: keeps taking captures for two more plies so a trade is not cut off half way. */
function quiesce(s: GState, alpha: number, beta: number, depth: number, b: Budget): number {
  let best = evaluate(s)
  if (best >= beta || depth === 0 || b.left <= 0) return best
  alpha = Math.max(alpha, best)
  for (const m of ordered(s, pseudoCaptures(s))) {
    b.left--
    if (kindOf(s.cells[m.to]) === KING) return MATE
    const v = -quiesce(stepRaw(s, m), -beta, -alpha, depth - 1, b)
    if (v > best) best = v
    if (best >= beta) break
    alpha = Math.max(alpha, best)
  }
  return best
}

function negamax(s: GState, depth: number, alpha: number, beta: number, ply: number, b: Budget): number {
  b.left--
  // A position in check is looked at one ply further, so a checkmate on the last ply is not missed.
  if (depth === 0 && ply < 6 && b.left > 0 && inCheckCells(s.cells, s.turn)) depth = 1
  if (depth === 0 || b.left <= 0) return quiesce(s, alpha, beta, b.left > 0 ? 2 : 0, b)
  const moves = legalMoves(s)
  if (!moves.length) return -MATE + ply
  let best = -Infinity
  for (const m of ordered(s, moves)) {
    const v = -negamax(stepRaw(s, m), depth - 1, -beta, -alpha, ply + 1, b)
    if (v > best) best = v
    alpha = Math.max(alpha, best)
    if (alpha >= beta) break
  }
  return best
}

/** The computer's move for the player to move. Easy picks at random among moves close to the best. */
export function chooseMove(s: GState, random: Random, level: Level = 'normal'): Move | null {
  const moves = legalMoves(s)
  if (!moves.length) return null
  if (moves.length === 1) return moves[0]
  const { depth, nodes } = SETTINGS[level]
  const budget: Budget = { left: nodes }
  const scored: { m: Move; v: number }[] = []
  let alpha = -Infinity
  for (const m of ordered(s, moves)) {
    const n = stepRaw(s, m)
    // A move that ends the game on the spot is always taken: the search is only to choose between the rest.
    const v = -negamax(n, depth - 1, -Infinity, -(alpha - (level === 'easy' ? 80 : 0)), 1, budget)
    scored.push({ m, v })
    if (v > alpha) alpha = v
  }
  scored.sort((a, b) => b.v - a.v)
  const top = scored[0].v
  const margin = level === 'easy' ? 80 : 0
  const pool = scored.filter((x) => x.v >= top - margin)
  return pool[Math.floor(random() * pool.length)].m
}
