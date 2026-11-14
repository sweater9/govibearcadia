import { createRandom, shuffle } from '../../lib/rng'

/** Cards 0..51: suit = floor(id / 13) (0 spades, the permanent trump; 1 hearts, 2 diamonds, 3 clubs), rank = id % 13 (0 ace .. 12 king). */
export const suitOf = (c: number) => Math.floor(c / 13)
export const rankOf = (c: number) => c % 13
/** Ace is high. */
export const strength = (c: number) => (rankOf(c) === 0 ? 13 : rankOf(c))

export const PLAYERS = 4
export const ROUNDS = 5
export const MIN_BID = 1
export const MAX_BID = 8

export type Phase = 'bid' | 'play' | 'round-over' | 'over'
export type Played = { player: number; card: number }
export type State = {
  seed: string
  /** 0 is you; seats go round in order. */
  round: number
  dealer: number
  phase: Phase
  hands: number[][]
  bids: (number | null)[]
  trick: Played[]
  /** The trick that just finished, kept on screen until the next card is played. */
  last: { cards: Played[]; winner: number } | null
  turn: number
  tricks: number[]
  /** Round scores in tenths, one array per finished round. */
  history: number[][]
}
export type Action = { type: 'bid'; bid: number } | { type: 'play'; card: number } | { type: 'next-round' }
export type Result = { ok: true; state: State } | { ok: false; reason: string }

const sortHand = (hand: number[]) => [...hand].sort((a, b) => suitOf(a) - suitOf(b) || strength(b) - strength(a))

export function deal(seed: string, round: number, dealer: number, history: number[][] = []): State {
  const order = shuffle(Array.from({ length: 52 }, (_, i) => i), createRandom(`${seed}:round:${round}`))
  const hands = Array.from({ length: PLAYERS }, (_, p) => sortHand(order.slice(p * 13, p * 13 + 13)))
  const first = (dealer + 1) % PLAYERS
  return { seed, round, dealer, phase: 'bid', hands, bids: [null, null, null, null], trick: [], last: null, turn: first, tricks: [0, 0, 0, 0], history }
}
export const newGame = (seed: string): State => deal(seed, 0, 0)

/** Cards the player to move may play: follow suit and beat the best card if you can; if you cannot follow, play a spade and beat any spade if you can. */
export function legalPlays(s: State): number[] {
  if (s.phase !== 'play') return []
  const hand = s.hands[s.turn]
  if (!s.trick.length) return hand
  const led = suitOf(s.trick[0].card)
  const follow = hand.filter((c) => suitOf(c) === led)
  const spadesInTrick = s.trick.filter((p) => suitOf(p.card) === 0)
  if (follow.length) {
    if (led !== 0 && spadesInTrick.length) return follow // already trumped, so nothing in this suit can win
    const best = Math.max(...s.trick.filter((p) => suitOf(p.card) === led).map((p) => strength(p.card)))
    const higher = follow.filter((c) => strength(c) > best)
    return higher.length ? higher : follow
  }
  const spades = hand.filter((c) => suitOf(c) === 0)
  if (!spades.length) return hand
  if (!spadesInTrick.length) return spades
  const bestSpade = Math.max(...spadesInTrick.map((p) => strength(p.card)))
  const over = spades.filter((c) => strength(c) > bestSpade)
  return over.length ? over : spades
}

export function trickWinner(trick: Played[]): number {
  const led = suitOf(trick[0].card)
  const trumps = trick.filter((p) => suitOf(p.card) === 0)
  const pool = trumps.length ? trumps : trick.filter((p) => suitOf(p.card) === led)
  return pool.reduce((a, b) => (strength(b.card) > strength(a.card) ? b : a)).player
}

/** Made your bid: the bid plus a tenth per extra trick. Missed it: minus the bid. In tenths. */
export const roundScore = (bid: number, won: number) => (won >= bid ? bid * 10 + (won - bid) : -bid * 10)
export const totals = (s: State) => Array.from({ length: PLAYERS }, (_, p) => s.history.reduce((n, r) => n + r[p], 0))
export const winners = (s: State) => { const t = totals(s); const top = Math.max(...t); return t.flatMap((v, i) => (v === top ? [i] : [])) }

export function apply(s: State, a: Action): Result {
  if (a.type === 'next-round') {
    if (s.phase !== 'round-over') return { ok: false, reason: 'The round is not over' }
    return { ok: true, state: deal(s.seed, s.round + 1, (s.dealer + 1) % PLAYERS, s.history) }
  }
  if (a.type === 'bid') {
    if (s.phase !== 'bid') return { ok: false, reason: 'Not the bidding stage' }
    if (!Number.isInteger(a.bid) || a.bid < MIN_BID || a.bid > MAX_BID) return { ok: false, reason: `Bid ${MIN_BID} to ${MAX_BID}` }
    const bids = s.bids.map((b, i) => (i === s.turn ? a.bid : b))
    const done = bids.every((b) => b !== null)
    return { ok: true, state: { ...s, bids, phase: done ? 'play' : 'bid', turn: done ? (s.dealer + 1) % PLAYERS : (s.turn + 1) % PLAYERS } }
  }
  if (s.phase !== 'play') return { ok: false, reason: 'Not the playing stage' }
  if (!legalPlays(s).includes(a.card)) return { ok: false, reason: 'That card cannot be played now' }
  const hands = s.hands.map((h, i) => (i === s.turn ? h.filter((c) => c !== a.card) : h))
  const trick = [...s.trick, { player: s.turn, card: a.card }]
  if (trick.length < PLAYERS) return { ok: true, state: { ...s, hands, trick, last: null, turn: (s.turn + 1) % PLAYERS } }
  const winner = trickWinner(trick)
  const tricks = s.tricks.map((n, i) => (i === winner ? n + 1 : n))
  const base = { ...s, hands, trick: [] as Played[], last: { cards: trick, winner }, tricks, turn: winner }
  if (hands[0].length) return { ok: true, state: base }
  const history = [...s.history, tricks.map((won, i) => roundScore(s.bids[i] as number, won))]
  return { ok: true, state: { ...base, history, phase: s.round + 1 >= ROUNDS ? 'over' : 'round-over' } }
}
