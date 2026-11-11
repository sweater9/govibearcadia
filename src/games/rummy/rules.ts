import { createRandom, shuffle } from '../../lib/rng'

/** Indian Rummy (13 cards): two 52-card decks plus two printed jokers, 106 cards. A card id is 0..105. */
export const DECK_SIZE = 106
export const HAND = 13
export const MAX_POINTS = 80
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 4
export const SUITS = ['♠', '♥', '♦', '♣'] as const

export type CardInfo = { id: number; rank: number; suit: number; printedJoker: boolean }
export function card(id: number): CardInfo {
  if (id >= 104) return { id, rank: 0, suit: -1, printedJoker: true }
  const n = id % 52
  return { id, rank: (n % 13) + 1, suit: Math.floor(n / 13), printedJoker: false }
}
export const rankLabel = (rank: number) => (rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : rank === 0 ? '★' : String(rank))
export const cardName = (id: number) => { const c = card(id); return c.printedJoker ? 'Joker' : `${rankLabel(c.rank)}${SUITS[c.suit]}` }

export type State = {
  players: number
  seed: string
  hands: number[][]
  stock: number[]
  discard: number[]
  /** Rank of the wild joker for this deal (1 to 13). */
  wild: number
  turn: number
  phase: 'draw' | 'discard' | 'done'
  /** The card taken from the discard pile this turn; it may not go straight back. */
  taken: number | null
  turns: number
  reshuffles: number
  winner: number | null
  scores: number[] | null
  message: string
}
export type Action =
  | { type: 'draw'; from: 'stock' | 'discard' }
  | { type: 'discard'; card: number }
  | { type: 'declare'; card: number; groups: number[][] }

export const maxTurns = (players: number) => players * 45

export function newGame(players: number, seed: string): State {
  const random = createRandom(`${seed}:deal`)
  const deck = shuffle(Array.from({ length: DECK_SIZE }, (_, i) => i), random)
  const hands = Array.from({ length: players }, (_, p) => deck.slice(p * HAND, (p + 1) * HAND))
  let at = players * HAND
  const cut = card(deck[at++])
  const discardFirst = deck[at++]
  return {
    players, seed, hands, stock: deck.slice(at), discard: [discardFirst],
    wild: cut.printedJoker ? 1 : cut.rank,
    turn: 0, phase: 'draw', taken: null, turns: 0, reshuffles: 0, winner: null, scores: null,
    message: `The wild joker is ${rankLabel(cut.printedJoker ? 1 : cut.rank)}.`,
  }
}

const isJoker = (id: number, wild: number) => { const c = card(id); return c.printedJoker || c.rank === wild }
export const cardPoints = (id: number, wild: number) => {
  if (isJoker(id, wild)) return 0
  const r = card(id).rank
  return r === 1 || r >= 11 ? 10 : r
}
export const handPoints = (ids: number[], wild: number) => ids.reduce((sum, id) => sum + cardPoints(id, wild), 0)

/** Ranks of a same-suit run, with the ace low or high. Returns true when the ranks are consecutive. */
function consecutive(ranks: number[]): boolean {
  const low = [...ranks].sort((a, b) => a - b)
  if (low.every((r, i) => i === 0 || r === low[i - 1] + 1)) return true
  const high = ranks.map((r) => (r === 1 ? 14 : r)).sort((a, b) => a - b)
  return high.every((r, i) => i === 0 || r === high[i - 1] + 1)
}

/** A pure sequence: 3+ consecutive cards of one suit with no joker standing in for another card. */
export function isPureRun(ids: number[]): boolean {
  if (ids.length < 3) return false
  const cs = ids.map(card)
  if (cs.some((c) => c.printedJoker) || cs.some((c) => c.suit !== cs[0].suit)) return false
  const ranks = cs.map((c) => c.rank)
  return new Set(ranks).size === ranks.length && consecutive(ranks)
}

/** A sequence, pure or with jokers (printed jokers or wild-rank cards) filling gaps. */
export function isRun(ids: number[], wild: number): boolean {
  if (ids.length < 3) return false
  if (isPureRun(ids)) return true
  const naturals = ids.filter((id) => !isJoker(id, wild)).map(card)
  if (naturals.length === 0) return false
  if (naturals.some((c) => c.suit !== naturals[0].suit)) return false
  const ranks = naturals.map((c) => c.rank)
  if (new Set(ranks).size !== ranks.length) return false
  const len = ids.length
  if (len > 14) return false
  return [false, true].some((aceHigh) => {
    const rs = ranks.map((r) => (aceHigh && r === 1 ? 14 : r))
    const min = Math.min(...rs)
    const max = Math.max(...rs)
    if (max - min + 1 > len) return false
    return Math.max(1, max - len + 1) <= Math.min(min, 14 - len + 1)
  })
}

/** A set: 3 or 4 cards of one rank in different suits; jokers may stand in. */
export function isSet(ids: number[], wild: number): boolean {
  if (ids.length < 3 || ids.length > 4) return false
  const natural = (list: CardInfo[]) => !list.some((c) => c.printedJoker) && new Set(list.map((c) => c.rank)).size === 1 && new Set(list.map((c) => c.suit)).size === list.length
  if (natural(ids.map(card))) return true
  const naturals = ids.filter((id) => !isJoker(id, wild)).map(card)
  return naturals.length > 0 && natural(naturals)
}

export type Meld = { ids: number[]; kind: 'pure' | 'run' | 'set' }
export const meldKind = (ids: number[], wild: number): Meld['kind'] | null => (isPureRun(ids) ? 'pure' : isRun(ids, wild) ? 'run' : isSet(ids, wild) ? 'set' : null)

function popcount(x: number): number {
  let n = 0
  for (; x; x &= x - 1) n++
  return n
}

export type Plan = { groups: Meld[]; loose: number[]; points: number; pure: boolean; runs: number; complete: boolean }

/** Best way to group the cards: fewest loose points, with a penalty when the pure sequence or a second sequence is missing. */
export function bestPlan(ids: number[], wild: number, penalty = { pure: 30, second: 15 }): Plan {
  const n = ids.length
  const melds: { mask: number; kind: Meld['kind'] }[] = []
  for (let mask = 1; mask < 1 << n; mask++) {
    const size = popcount(mask)
    if (size < 3 || size > 5) continue
    const sub = ids.filter((_, i) => mask & (1 << i))
    const kind = meldKind(sub, wild)
    if (kind) melds.push({ mask, kind })
  }
  const byLow: { mask: number; kind: Meld['kind'] }[][] = Array.from({ length: n }, () => [])
  for (const m of melds) byLow[31 - Math.clz32(m.mask & -m.mask)].push(m)
  const points = ids.map((id) => cardPoints(id, wild))
  const memo = new Map<number, { score: number; pick: { mask: number; kind: Meld['kind'] } | null | 'loose' }>()
  // state: remaining mask, pure used (0/1), runs (0..2)
  const solve = (mask: number, pure: number, runs: number): number => {
    if (mask === 0) return (pure ? 0 : penalty.pure) + (runs >= 2 ? 0 : penalty.second)
    const key = (mask * 2 + pure) * 3 + runs
    const hit = memo.get(key)
    if (hit) return hit.score
    const low = 31 - Math.clz32(mask & -mask)
    let best = points[low] + solve(mask & ~(1 << low), pure, runs)
    let pick: { mask: number; kind: Meld['kind'] } | null | 'loose' = 'loose'
    for (const m of byLow[low]) {
      if ((m.mask & mask) !== m.mask) continue
      const score = solve(mask & ~m.mask, pure || (m.kind === 'pure' ? 1 : 0), Math.min(2, runs + (m.kind === 'set' ? 0 : 1)))
      if (score < best) { best = score; pick = m }
    }
    memo.set(key, { score: best, pick })
    return best
  }
  const full = (1 << n) - 1
  solve(full, 0, 0)
  const groups: Meld[] = []
  const loose: number[] = []
  let mask = full, pure = 0, runs = 0
  while (mask) {
    const key = (mask * 2 + pure) * 3 + runs
    const entry = memo.get(key)!
    const low = 31 - Math.clz32(mask & -mask)
    if (entry.pick === 'loose' || entry.pick === null) { loose.push(ids[low]); mask &= ~(1 << low) } else {
      const m = entry.pick
      groups.push({ ids: ids.filter((_, i) => m.mask & (1 << i)), kind: m.kind })
      mask &= ~m.mask
      if (m.kind === 'pure') pure = 1
      if (m.kind !== 'set') runs = Math.min(2, runs + 1)
    }
  }
  return { groups, loose, points: handPoints(loose, wild), pure: pure === 1, runs, complete: pure === 1 && runs >= 2 }
}

/** What a player scores when someone else declares: everything counts unless a pure sequence and a second sequence exist. */
export function penaltyPoints(ids: number[], wild: number): number {
  const plan = bestPlan(ids, wild, { pure: 1000, second: 1000 })
  const raw = plan.complete ? plan.points : handPoints(ids, wild)
  return Math.min(MAX_POINTS, raw)
}

/** Why a declaration would be refused, or null when it is valid. */
export function declareError(hand: number[], discarded: number, groups: number[][], wild: number): string | null {
  if (!hand.includes(discarded)) return 'Choose a card to discard.'
  const rest = hand.filter((id) => id !== discarded)
  const used = groups.flat()
  if (used.length !== rest.length || new Set(used).size !== used.length || used.some((id) => !rest.includes(id))) return 'Every card must be in a group.'
  const kinds = groups.map((g) => meldKind(g, wild))
  if (kinds.some((k) => k === null)) return 'Every group must be a sequence or a set.'
  if (!kinds.includes('pure')) return 'You need a pure sequence (no joker).'
  if (kinds.filter((k) => k !== 'set').length < 2) return 'You need a second sequence.'
  return null
}

function reshuffleIfEmpty(s: State): State {
  if (s.stock.length > 0 || s.discard.length < 2) return s
  const top = s.discard[s.discard.length - 1]
  const rest = s.discard.slice(0, -1)
  return { ...s, stock: shuffle(rest, createRandom(`${s.seed}:reshuffle${s.reshuffles}`)), discard: [top], reshuffles: s.reshuffles + 1 }
}

function finish(s: State, winner: number | null, message: string): State {
  const scores = s.hands.map((h, p) => (p === winner ? 0 : penaltyPoints(h, s.wild)))
  const lowest = winner ?? scores.indexOf(Math.min(...scores))
  return { ...s, phase: 'done', winner: lowest, scores, message }
}

export function applyAction(state: State, action: Action): State {
  if (state.phase === 'done') return state
  const s = reshuffleIfEmpty(state)
  const hand = s.hands[s.turn]
  if (action.type === 'draw') {
    if (s.phase !== 'draw') return state
    if (action.from === 'stock') {
      if (s.stock.length === 0) return state
      const drawn = s.stock[s.stock.length - 1]
      return withHand({ ...s, stock: s.stock.slice(0, -1), phase: 'discard', taken: null, message: '' }, [...hand, drawn])
    }
    if (s.discard.length === 0) return state
    const top = s.discard[s.discard.length - 1]
    return withHand({ ...s, discard: s.discard.slice(0, -1), phase: 'discard', taken: top, message: '' }, [...hand, top])
  }
  if (s.phase !== 'discard') return state
  if (action.type === 'discard') {
    if (!hand.includes(action.card) || action.card === s.taken) return state
    const next = { ...withHand(s, hand.filter((id) => id !== action.card)), discard: [...s.discard, action.card], phase: 'draw' as const, taken: null, turn: (s.turn + 1) % s.players, turns: s.turns + 1, message: '' }
    return next.turns >= maxTurns(s.players) ? finish(next, null, 'The turn limit was reached: lowest points wins.') : next
  }
  if (action.card === s.taken) return state
  if (declareError(hand, action.card, action.groups, s.wild) !== null) return state
  const next = { ...withHand(s, hand.filter((id) => id !== action.card)), discard: [...s.discard, action.card] }
  return finish(next, s.turn, 'Valid declaration.')
}

function withHand(s: State, hand: number[]): State {
  return { ...s, hands: s.hands.map((h, p) => (p === s.turn ? hand : h)) }
}
