import type { Random } from './rng'

/**
 * Generic negamax with alpha-beta pruning, for two-player turn-based games with perfect information.
 * Pure: no React or browser APIs, so a Worker or a server can run it too. A game describes itself with `SearchGame`;
 * scores are always from the point of view of the side to move in that state.
 */
export type SearchGame<S, M> = {
  /** Legal moves for the side to move. */
  moves(s: S): M[]
  /** The state after a legal move. */
  apply(s: S, m: M): S
  /** Static score for the side to move (positive is good for them). */
  evaluate(s: S): number
  /** Score when the side to move has no moves (a loss, a draw...). `ply` is the distance from the root, so quicker wins score higher. Defaults to 0. */
  noMoves?(s: S, ply: number): number
  /** Moves best-first; good ordering makes pruning much stronger. Defaults to the order given. */
  order?(s: S, moves: M[]): M[]
  /** Called instead of `evaluate` when the depth runs out, e.g. to keep searching captures. Must return a score for the side to move. */
  leaf?(s: S, alpha: number, beta: number): number
}

export type Scored<M> = { move: M; score: number }

/** A score big enough to beat any evaluation; a win at ply `p` scores `WIN - p`. */
export const WIN = 100_000

export function negamax<S, M>(game: SearchGame<S, M>, s: S, depth: number, alpha: number, beta: number, ply = 0): number {
  const moves = game.moves(s)
  if (!moves.length) return game.noMoves ? game.noMoves(s, ply) : 0
  if (depth === 0) return game.leaf ? game.leaf(s, alpha, beta) : game.evaluate(s)
  let best = -Infinity
  for (const m of game.order ? game.order(s, moves) : moves) {
    const score = -negamax(game, game.apply(s, m), depth - 1, -beta, -alpha, ply + 1)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

/** Every root move with its score, searched `depth` plies deep. Each root move gets a full window so the scores are exact. */
export function scoreMoves<S, M>(game: SearchGame<S, M>, s: S, depth: number): Scored<M>[] {
  const moves = game.moves(s)
  return (game.order ? game.order(s, moves) : moves).map((move) => ({ move, score: -negamax(game, game.apply(s, move), depth - 1, -Infinity, Infinity, 1) }))
}

/** One of the moves within `slack` of the best, chosen with the seeded `random`. A slack of 0 always plays a best move. */
export function pickMove<M>(scored: Scored<M>[], slack: number, random: Random): M | null {
  if (!scored.length) return null
  const top = Math.max(...scored.map((x) => x.score))
  const pool = scored.filter((x) => x.score >= top - slack)
  return pool[Math.floor(random() * pool.length)].move
}

/** The whole thing: score the moves and pick one. `null` when there is no move. */
export function searchMove<S, M>(game: SearchGame<S, M>, s: S, depth: number, slack: number, random: Random): M | null {
  return pickMove(scoreMoves(game, s, depth), slack, random)
}
