import type { Random } from '../../lib/rng'
import { applyMove, legalMoves, NEIGHBORS, type Move, type Side, type State } from './rules'

function evaluate(s: State, me: Side): number {
  if (s.winner) return s.winner === me ? 100000 : -100000
  const tigerMobility = legalMoves({ ...s, turn: 'tigers' }).length
  const valueForTigers = s.goatsCaptured * 500 + tigerMobility * 12 - s.cells.reduce((sum, p, i) => sum + (p === 'T' ? NEIGHBORS[i].filter((n) => s.cells[n] === null).length : 0), 0)
  return me === 'tigers' ? valueForTigers : -valueForTigers
}

function search(s: State, depth: number, alpha: number, beta: number, me: Side): number {
  if (depth === 0 || s.winner) return evaluate(s, me)
  const maximizing = s.turn === me
  let best = maximizing ? -Infinity : Infinity
  for (const move of legalMoves(s)) {
    const value = search(applyMove(s, move), depth - 1, alpha, beta, me)
    if (maximizing) { best = Math.max(best, value); alpha = Math.max(alpha, best) }
    else { best = Math.min(best, value); beta = Math.min(beta, best) }
    if (alpha >= beta) break
  }
  return best
}

export function chooseMove(s: State, random: Random = Math.random, depth = 2): Move | null {
  const moves = legalMoves(s)
  if (!moves.length) return null
  const captures = moves.filter((m) => m.captured !== null)
  const candidates = captures.length ? captures : moves
  let best = -Infinity
  let choices: Move[] = []
  for (const move of candidates) {
    const value = search(applyMove(s, move), depth - 1, -Infinity, Infinity, s.turn)
    if (value > best) { best = value; choices = [move] }
    else if (value === best) choices.push(move)
  }
  return choices[Math.floor(random() * choices.length)]
}
