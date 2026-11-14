import { apply, isWon, legalMoves, type Action, type State } from './rules'

const key = (s: State) => `${s.stock.join(',')}|${s.waste.join(',')}|${s.foundations.map((f) => f.length).join('')}|${s.tableau.map((p) => `${p.down.length}:${p.up.join('.')}`).join('/')}`

/**
 * Looks for a winning line from `start` by depth-first search with a node budget; returns the moves, or null when it finds none within the budget.
 * The search prefers moves that make progress (foundations, flipping a face-down card) and never repeats a position, so it is quick on most deals.
 */
export function solve(start: State, budget = 250_000): Action[] | null {
  if (isWon(start)) return []
  const order = (s: State): Action[] => {
    const score = (m: Action) => (m.type === 'draw' ? 0 : m.to === 'foundation' ? 4 : m.from === 'tableau' && s.tableau[m.pile].down.length && m.index === 0 ? 3 : m.from === 'waste' ? 2 : 1)
    return [...legalMoves(s)].sort((a, b) => score(b) - score(a)).concat({ type: 'draw' })
  }
  const seen = new Set<string>([key(start)])
  const frames: { s: State; moves: Action[]; i: number }[] = [{ s: start, moves: order(start), i: 0 }]
  const path: Action[] = []
  let nodes = 0
  while (frames.length) {
    const f = frames[frames.length - 1]
    if (f.i >= f.moves.length) { frames.pop(); path.pop(); continue }
    const m = f.moves[f.i++]
    const next = apply(f.s, m)
    if (next === f.s) continue
    if (isWon(next)) return [...path, m]
    if (++nodes > budget) return null
    const k = key(next)
    if (seen.has(k)) continue
    seen.add(k)
    frames.push({ s: next, moves: order(next), i: 0 })
    path.push(m)
  }
  return null
}
