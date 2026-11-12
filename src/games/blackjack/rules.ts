import { createRandom, shuffle } from '../../lib/rng'
import { DEFAULT_BLACKJACK_TABLE, blackjackTable } from '../../lib/tables'

/** Blackjack with play-money chips: six decks, dealer stands on all 17s, blackjack pays 3:2, double on any two cards, one split. */
export const DECKS = 6
export const START_CHIPS = 1000
export const MIN_BET = 10
export const MAX_BET = 500
export const BET_STEP = 5
export const SUITS = ['♠', '♥', '♦', '♣'] as const

/** A card is 0..51: rank = id % 13 + 1 (1 ace, 11 to 13 court), suit = floor(id / 13). */
export const rankOf = (id: number) => (id % 13) + 1
export const suitOf = (id: number) => Math.floor((id % 52) / 13)
export const rankLabel = (r: number) => (r === 1 ? 'A' : r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : String(r))
export const cardName = (id: number) => `${rankLabel(rankOf(id % 52))}${SUITS[suitOf(id)]}`
const pip = (id: number) => Math.min(10, rankOf(id % 52))

export function handValue(cards: number[]): { total: number; soft: boolean } {
  const total = cards.reduce((sum, id) => sum + pip(id), 0)
  const hasAce = cards.some((id) => rankOf(id % 52) === 1)
  if (hasAce && total + 10 <= 21) return { total: total + 10, soft: true }
  return { total, soft: false }
}
export const isBlackjack = (cards: number[]) => cards.length === 2 && handValue(cards).total === 21
export const isBust = (cards: number[]) => handValue(cards).total > 21

export type Hand = { cards: number[]; bet: number; doubled: boolean; done: boolean; fromSplit: boolean; result?: 'win' | 'lose' | 'push' | 'blackjack'; payout?: number }
export type State = {
  seed: string
  /** Which table (stakes) this session is at; see lib/tables. */
  table: string
  /** Chips this session began with (the carried-over bankroll); a win is finishing above it. */
  startChips: number
  shoeNo: number
  pos: number
  chips: number
  phase: 'bet' | 'play' | 'settled' | 'over'
  hands: Hand[]
  active: number
  dealer: number[]
  rounds: number
  blackjacks: number
  peak: number
  lastBet: number
  message: string
}
export type Action =
  | { type: 'bet'; amount: number }
  | { type: 'hit' }
  | { type: 'stand' }
  | { type: 'double' }
  | { type: 'split' }
  | { type: 'cashout' }

export const newGame = (seed: string, startChips: number = START_CHIPS, table: string = DEFAULT_BLACKJACK_TABLE): State => ({ seed, table, startChips, shoeNo: 0, pos: 0, chips: startChips, phase: 'bet', hands: [], active: 0, dealer: [], rounds: 0, blackjacks: 0, peak: startChips, lastBet: 50, message: 'Place your bet.' })

const shoeFor = (seed: string, no: number) => shuffle(Array.from({ length: DECKS * 52 }, (_, i) => i), createRandom(`${seed}:shoe${no}`))

/** Draws the next card, starting a freshly shuffled shoe when fewer than a quarter of the cards are left. */
function draw(s: State): [number, State] {
  let { shoeNo, pos } = s
  if (pos >= DECKS * 52 - 1) { shoeNo++; pos = 0 }
  const id = shoeFor(s.seed, shoeNo)[pos]
  return [id, { ...s, shoeNo, pos: pos + 1 }]
}
const deal = (s: State, to: 'dealer' | number): State => {
  const [id, next] = draw(s)
  if (to === 'dealer') return { ...next, dealer: [...next.dealer, id] }
  return { ...next, hands: next.hands.map((h, i) => (i === to ? { ...h, cards: [...h.cards, id] } : h)) }
}

export const maxBetFor = (chips: number, max: number = MAX_BET) => Math.min(max, Math.floor(chips / BET_STEP) * BET_STEP)
export const validBet = (amount: number, chips: number, limits: { min: number; max: number } = { min: MIN_BET, max: MAX_BET }) =>
  Number.isInteger(amount) && amount >= limits.min && amount <= maxBetFor(chips, limits.max) && amount % BET_STEP === 0
export const canDouble = (s: State) => s.phase === 'play' && s.hands[s.active].cards.length === 2 && s.chips >= s.hands[s.active].bet
export const canSplit = (s: State) => {
  if (s.phase !== 'play' || s.hands.length !== 1) return false
  const h = s.hands[0]
  return h.cards.length === 2 && pip(h.cards[0]) === pip(h.cards[1]) && s.chips >= h.bet
}

function settle(s: State): State {
  const live = s.hands.some((h) => !isBust(h.cards) && !(isBlackjack(h.cards) && !h.fromSplit))
  let next = s
  if (live) while (handValue(next.dealer).total < 17) next = deal(next, 'dealer')
  const dealer = handValue(next.dealer).total
  const dealerBj = isBlackjack(next.dealer)
  let chips = next.chips
  let blackjacks = next.blackjacks
  const hands = next.hands.map((h): Hand => {
    const total = handValue(h.cards).total
    const bj = isBlackjack(h.cards) && !h.fromSplit
    let result: Hand['result']
    let payout: number
    if (isBust(h.cards)) { result = 'lose'; payout = 0 }
    else if (bj && !dealerBj) { result = 'blackjack'; payout = h.bet * 2.5 }
    else if (dealerBj) { result = bj ? 'push' : 'lose'; payout = bj ? h.bet : 0 }
    else if (dealer > 21 || total > dealer) { result = 'win'; payout = h.bet * 2 }
    else if (total === dealer) { result = 'push'; payout = h.bet }
    else { result = 'lose'; payout = 0 }
    if (result === 'blackjack') blackjacks++
    chips += payout
    return { ...h, done: true, result, payout }
  })
  const net = hands.reduce((sum, h) => sum + (h.payout ?? 0) - h.bet * (h.doubled ? 2 : 1), 0)
  const over = chips < blackjackTable(next.table).min
  const message = over ? 'Out of chips.' : net > 0 ? `You win ${net}.` : net < 0 ? `You lose ${-net}.` : 'Push.'
  return { ...next, hands, chips, blackjacks, peak: Math.max(next.peak, chips), phase: over ? 'over' : 'settled', rounds: next.rounds + 1, message }
}

/** After a hand finishes, move to the next unfinished hand, or let the dealer play and settle. */
function advance(s: State): State {
  const next = s.hands.findIndex((h) => !h.done)
  return next === -1 ? settle(s) : { ...s, active: next }
}

export function applyAction(s: State, a: Action): State {
  if (s.phase === 'over') return s
  if (a.type === 'cashout') return s.phase === 'bet' || s.phase === 'settled' ? { ...s, phase: 'over', message: 'Cashed out.' } : s
  if (a.type === 'bet') {
    if ((s.phase !== 'bet' && s.phase !== 'settled') || !validBet(a.amount, s.chips, blackjackTable(s.table))) return s
    let n: State = { ...s, chips: s.chips - a.amount, lastBet: a.amount, phase: 'play', hands: [{ cards: [], bet: a.amount, doubled: false, done: false, fromSplit: false }], active: 0, dealer: [], message: '' }
    n = deal(n, 0); n = deal(n, 'dealer'); n = deal(n, 0); n = deal(n, 'dealer')
    const upcard = pip(n.dealer[0])
    const dealerPeek = (upcard === 10 || upcard === 1) && isBlackjack(n.dealer)
    if (isBlackjack(n.hands[0].cards) || dealerPeek) return settle(n)
    return n
  }
  if (s.phase !== 'play') return s
  const h = s.hands[s.active]
  const setHand = (state: State, patch: Partial<Hand>): State => ({ ...state, hands: state.hands.map((x, i) => (i === state.active ? { ...x, ...patch } : x)) })
  if (a.type === 'stand') return advance(setHand(s, { done: true }))
  if (a.type === 'hit') {
    if (h.doubled) return s
    const n = deal(s, s.active)
    const cards = n.hands[s.active].cards
    return handValue(cards).total >= 21 ? advance(setHand(n, { done: true })) : n
  }
  if (a.type === 'double') {
    if (!canDouble(s)) return s
    const n = deal({ ...s, chips: s.chips - h.bet }, s.active)
    return advance(setHand(n, { doubled: true, done: true }))
  }
  if (a.type === 'split') {
    if (!canSplit(s)) return s
    const base: State = { ...s, chips: s.chips - h.bet, hands: [{ ...h, cards: [h.cards[0]], fromSplit: true }, { ...h, cards: [h.cards[1]], fromSplit: true }] }
    let n = deal(base, 0)
    n = deal(n, 1)
    const aces = rankOf(h.cards[0] % 52) === 1
    if (aces) n = { ...n, hands: n.hands.map((x) => ({ ...x, done: true })) }
    else n = { ...n, hands: n.hands.map((x) => (handValue(x.cards).total >= 21 ? { ...x, done: true } : x)) }
    return advance({ ...n, active: 0 })
  }
  return s
}

/** Basic strategy (six decks, dealer stands on 17, double any two cards, split once): a hint for the player and a deterministic player for tests. */
export function basicStrategy(s: State): Action['type'] {
  const h = s.hands[s.active]
  const up = pip(s.dealer[0])
  const { total, soft } = handValue(h.cards)
  const two = h.cards.length === 2
  if (canSplit(s)) {
    const p = pip(h.cards[0])
    if (p === 1 || p === 8) return 'split'
    if ((p === 2 || p === 3 || p === 7) && up <= 7) return 'split'
    if (p === 6 && up <= 6) return 'split'
    if (p === 9 && up !== 7 && up <= 9 && up !== 1) return 'split'
  }
  const dbl = (ok: boolean) => (ok && canDouble(s) && two ? 'double' : null)
  if (soft) {
    if (total >= 19) return 'stand'
    if (total === 18) return dbl(up >= 3 && up <= 6) ?? (up >= 9 || up === 1 ? 'hit' : 'stand')
    if (total === 17) return dbl(up >= 3 && up <= 6) ?? 'hit'
    if (total >= 15) return dbl(up >= 4 && up <= 6) ?? 'hit'
    return dbl(up >= 5 && up <= 6) ?? 'hit'
  }
  if (total >= 17) return 'stand'
  if (total >= 13) return up >= 2 && up <= 6 ? 'stand' : 'hit'
  if (total === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit'
  if (total === 11) return dbl(true) ?? 'hit'
  if (total === 10) return dbl(up <= 9 && up !== 1) ?? 'hit'
  if (total === 9) return dbl(up >= 3 && up <= 6) ?? 'hit'
  return 'hit'
}
