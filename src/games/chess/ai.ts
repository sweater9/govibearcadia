import type { Random } from '../../lib/rng'
import { applyFast, attacked, inCheck, legalMoves, type Move, type State } from './rules'

export type Level = 'easy' | 'normal' | 'hard'
export const LEVELS: Level[] = ['easy', 'normal', 'hard']
const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }
const MATE = 100_000

/** Small bonuses for central squares, from White's side; Black uses the mirrored square. */
const CENTRE = Array.from({ length: 64 }, (_, sq) => { const r = Math.floor(sq / 8); const f = sq % 8; return Math.round(6 - (Math.abs(3.5 - r) + Math.abs(3.5 - f)) * 1.8) })
const PAWN_ADVANCE = (rank: number) => (6 - rank) * 6 // rank 0 is the top row (rank 8)

/** Score for the side to move: material, centre control, pawn advance, and a little for king safety. */
export function evaluate(s: State): number {
  let score = 0
  for (let sq = 0; sq < 64; sq++) {
    const p = s.board[sq]
    if (!p) continue
    const white = p === p.toUpperCase()
    const kind = p.toLowerCase()
    const row = Math.floor(sq / 8)
    let v = VALUE[kind]
    if (kind === 'n' || kind === 'b' || kind === 'q') v += CENTRE[sq]
    else if (kind === 'p') v += CENTRE[sq] / 2 + (white ? PAWN_ADVANCE(row) : PAWN_ADVANCE(7 - row))
    else if (kind === 'k') v += (white ? row : 7 - row) >= 6 ? 12 : 0 // stay home
    score += white ? v : -v
  }
  return s.turn === 'w' ? score : -score
}

const order = (s: State, moves: Move[]) =>
  moves
    .map((m) => {
      const victim = s.board[m.to] ? VALUE[s.board[m.to].toLowerCase()] : 0
      const mover = VALUE[s.board[m.from].toLowerCase()]
      return { m, k: (victim ? 10 * victim - mover : 0) + (m.promo === 'q' ? 800 : 0) }
    })
    .sort((a, b) => b.k - a.k)
    .map((x) => x.m)

type Budget = { nodes: number }

function quiesce(s: State, alpha: number, beta: number, depth: number, b: Budget): number {
  b.nodes++
  const stand = evaluate(s)
  if (depth === 0 || stand >= beta) return stand
  alpha = Math.max(alpha, stand)
  for (const m of order(s, legalMoves(s).filter((x) => s.board[x.to] || x.promo))) {
    const score = -quiesce(applyFast(s, m), -beta, -alpha, depth - 1, b)
    if (score >= beta) return score
    if (score > alpha) alpha = score
  }
  return alpha
}

function negamax(s: State, depth: number, alpha: number, beta: number, ply: number, b: Budget, quiet: boolean): number {
  b.nodes++
  const moves = legalMoves(s)
  if (!moves.length) return inCheck(s) ? -MATE + ply : 0
  if (depth === 0) return quiet ? quiesce(s, alpha, beta, 4, b) : evaluate(s)
  let best = -Infinity
  for (const m of order(s, moves)) {
    const score = -negamax(applyFast(s, m), depth - 1, -beta, -alpha, ply + 1, b, quiet)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

const SETTINGS: Record<Level, { depth: number; quiet: boolean; slack: number }> = {
  easy: { depth: 1, quiet: false, slack: 60 },
  normal: { depth: 2, quiet: true, slack: 0 },
  hard: { depth: 3, quiet: true, slack: 0 },
}

/** Pick a move. Easy looks one move ahead and sometimes plays a near-best alternative; normal and hard search two and three moves deep and always take the best. */
export function chooseMove(s: State, level: Level, random: Random): Move | null {
  const moves = legalMoves(s)
  if (!moves.length) return null
  const { depth, quiet, slack } = SETTINGS[level]
  const scored = order(s, moves).map((m) => ({ m, score: -negamax(applyFast(s, m), depth - 1, -Infinity, Infinity, 1, { nodes: 0 }, quiet) }))
  const top = Math.max(...scored.map((x) => x.score))
  const pool = scored.filter((x) => x.score >= top - slack)
  return pool[Math.floor(random() * pool.length)].m
}

export { attacked }
