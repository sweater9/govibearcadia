import { createRandom, shuffle } from '../../lib/rng'

/** A card is 0..51: suit = floor(id / 13) (0 spades, 1 hearts, 2 diamonds, 3 clubs), rank = id % 13 (0 ace .. 12 king). */
export const suitOf = (c: number) => Math.floor(c / 13)
export const rankOf = (c: number) => c % 13
export const isRed = (c: number) => suitOf(c) === 1 || suitOf(c) === 2

export type Pile = { down: number[]; up: number[] }
export type DrawMode = 1 | 3
export type State = {
  tableau: Pile[]
  /** Face-down stock; the top is the end of the array. */
  stock: number[]
  /** Face-up waste; the top is the end of the array. */
  waste: number[]
  /** One pile per suit, built from the ace up. */
  foundations: number[][]
  draw: DrawMode
  moves: number
  /** Standard Klondike scoring, never below zero. */
  points: number
  /** Passes through the stock so far. */
  recycles: number
}

export type Source = { from: 'waste' } | { from: 'foundation'; suit: number } | { from: 'tableau'; pile: number; index: number }
export type Target = { to: 'foundation' } | { to: 'tableau'; dest: number }
export type Action = { type: 'draw' } | ({ type: 'move' } & Source & Target)

export const newGame = (seed: string, draw: DrawMode = 1): State => {
  const order = shuffle(Array.from({ length: 52 }, (_, i) => i), createRandom(seed))
  const tableau: Pile[] = []
  let at = 0
  for (let p = 0; p < 7; p++) {
    const down = order.slice(at, at + p)
    at += p
    tableau.push({ down, up: [order[at++]] })
  }
  return { tableau, stock: order.slice(at), waste: [], foundations: [[], [], [], []], draw, moves: 0, points: 0, recycles: 0 }
}

export const isWon = (s: State) => s.foundations.every((f) => f.length === 13)

const clone = (s: State): State => ({ ...s, tableau: s.tableau.map((p) => ({ down: [...p.down], up: [...p.up] })), stock: [...s.stock], waste: [...s.waste], foundations: s.foundations.map((f) => [...f]) })

/** The cards a source would pick up, bottom first; null when the source is not valid. */
export function picked(s: State, src: Source): number[] | null {
  if (src.from === 'waste') return s.waste.length ? [s.waste[s.waste.length - 1]] : null
  if (src.from === 'foundation') {
    const f = s.foundations[src.suit]
    return f && f.length ? [f[f.length - 1]] : null
  }
  const pile = s.tableau[src.pile]
  if (!pile || !Number.isInteger(src.index) || src.index < 0 || src.index >= pile.up.length) return null
  return pile.up.slice(src.index)
}

const fitsTableau = (card: number, top: number | undefined) => (top === undefined ? rankOf(card) === 12 : isRed(card) !== isRed(top) && rankOf(card) === rankOf(top) - 1)
const fitsFoundation = (s: State, card: number) => {
  const f = s.foundations[suitOf(card)]
  return f.length === rankOf(card)
}

export function canMove(s: State, src: Source, to: Target): boolean {
  const cards = picked(s, src)
  if (!cards) return false
  if (to.to === 'foundation') return cards.length === 1 && fitsFoundation(s, cards[0]) && !(src.from === 'foundation')
  const pile = s.tableau[to.dest]
  if (!pile) return false
  if (src.from === 'tableau' && src.pile === to.dest) return false
  const top = pile.up.length ? pile.up[pile.up.length - 1] : pile.down.length ? -1 : undefined
  if (top === -1) return false
  return fitsTableau(cards[0], top)
}

export function apply(s: State, a: Action): State {
  const next = clone(s)
  if (a.type === 'draw') {
    if (next.stock.length) {
      const take = Math.min(next.draw, next.stock.length)
      for (let i = 0; i < take; i++) next.waste.push(next.stock.pop()!)
    } else if (next.waste.length) {
      next.stock = next.waste.reverse()
      next.waste = []
      next.recycles += 1
      next.points = Math.max(0, next.points - (next.draw === 1 ? 100 : 20))
    } else return s
    next.moves += 1
    return next
  }
  if (!canMove(s, a, a as Target)) return s
  const cards = picked(s, a)!
  if (a.from === 'waste') next.waste.pop()
  else if (a.from === 'foundation') next.foundations[a.suit].pop()
  else {
    const pile = next.tableau[a.pile]
    pile.up = pile.up.slice(0, a.index)
    if (!pile.up.length && pile.down.length) { pile.up = [pile.down.pop()!]; next.points += 5 }
  }
  if (a.to === 'foundation') {
    next.foundations[suitOf(cards[0])].push(cards[0])
    next.points += 10
  } else {
    next.tableau[a.dest].up.push(...cards)
    if (a.from === 'waste') next.points += 5
    else if (a.from === 'foundation') next.points = Math.max(0, next.points - 15)
  }
  next.moves += 1
  return next
}

/** Every legal move, foundations first so a hint or auto-play prefers progress. */
export function legalMoves(s: State): Action[] {
  const out: Action[] = []
  const sources: Source[] = [{ from: 'waste' }, ...s.foundations.map((_, suit): Source => ({ from: 'foundation', suit })), ...s.tableau.flatMap((p, pile) => p.up.map((_, index): Source => ({ from: 'tableau', pile, index })))]
  for (const src of sources) {
    const cards = picked(s, src)
    if (!cards) continue
    if (canMove(s, src, { to: 'foundation' })) out.push({ type: 'move', ...src, to: 'foundation' })
    s.tableau.forEach((_, dest) => { if (canMove(s, src, { to: 'tableau', dest })) out.push({ type: 'move', ...src, to: 'tableau', dest }) })
  }
  return out
}

/** Moves a card to its foundation if it can go there (used for double tap). */
export function toFoundation(s: State, src: Source): State {
  return canMove(s, src, { to: 'foundation' }) ? apply(s, { type: 'move', ...src, to: 'foundation' }) : s
}

/** Once every tableau card is face up, the rest is automatic. */
export const canAutoFinish = (s: State) => !isWon(s) && s.tableau.every((p) => p.down.length === 0) && s.stock.length === 0 && s.waste.length <= 1

export function autoFinish(s: State): State {
  let cur = s
  for (let guard = 0; guard < 200 && !isWon(cur); guard++) {
    const next = legalMoves(cur).find((m) => m.type === 'move' && m.to === 'foundation')
    if (!next) break
    cur = apply(cur, next)
  }
  return cur
}

/** Nothing left to do: no legal move and no cards left to draw or recycle (a recycle only helps if it can reveal something new, so it counts as a move). */
export const hasMoves = (s: State) => legalMoves(s).length > 0 || s.stock.length > 0 || s.waste.length > 0
