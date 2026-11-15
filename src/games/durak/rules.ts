import { createRandom, shuffle } from '../../lib/rng'

/**
 * Pure rules for two-player Durak ("the fool"): a 36-card deck (6 to ace), the bottom card names the trump suit,
 * the attacker leads cards and the defender must beat each one or take them all. No React or browser APIs.
 *
 * Rules as implemented: no transferring (the "perevodnoy" variant is off); the attacker may add cards of any rank
 * already on the table, up to six in a bout and never more than the defender held when the bout began; after a bout
 * both players refill to six, the attacker first; when the deck is gone the first to empty their hand wins and the
 * other is the durak; if both empty together it is a draw.
 *
 * Player 0 is you, player 1 is the computer. A card is 0..35: rank index = id % 9 (0 is the six, 8 the ace),
 * suit = floor(id / 9).
 */
export type Who = 0 | 1
export const HAND = 6
export const rankOf = (id: number) => id % 9
export const suitOf = (id: number) => Math.floor(id / 9)
const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
export const SUITS = ['♠', '♥', '♦', '♣'] as const
export const cardName = (id: number) => `${RANKS[rankOf(id)]}${SUITS[suitOf(id)]}`
export const rankLabel = (id: number) => RANKS[rankOf(id)]
export const other = (w: Who): Who => (w === 0 ? 1 : 0)

export type Pair = { attack: number; defence: number | null }
export type Phase = 'attack' | 'defend' | 'take' | 'over'

export type DState = {
  seed: string
  /** The draw pile. Cards are drawn from the end; index 0 is the face-up trump card, drawn last. */
  deck: number[]
  trump: number
  trumpCard: number
  hands: [number[], number[]]
  attacker: Who
  table: Pair[]
  /** attack: the attacker leads or adds; defend: the defender must beat or take; take: the defender has taken and the attacker may add more. */
  phase: Phase
  /** Most attacks this bout: six, or the defender's hand size when it began if that is smaller. */
  limit: number
  winner: Who | null
  durak: Who | null
  draw: boolean
  bouts: number
  moves: number
  note: string
}

const sorted = (a: number[], trump: number) => [...a].sort((x, y) => (suitOf(x) === trump ? 1 : 0) - (suitOf(y) === trump ? 1 : 0) || suitOf(x) - suitOf(y) || rankOf(x) - rankOf(y))

export function newGame(seed = 'durak'): DState {
  const deck = shuffle(Array.from({ length: 36 }, (_, i) => i), createRandom(seed))
  const trumpCard = deck[0]
  const trump = suitOf(trumpCard)
  const h0 = deck.splice(-HAND)
  const h1 = deck.splice(-HAND)
  const lowest = (h: number[]) => Math.min(...h.filter((c) => suitOf(c) === trump).map(rankOf), 99)
  const attacker: Who = lowest(h1) < lowest(h0) ? 1 : 0
  return {
    seed, deck, trump, trumpCard, hands: [sorted(h0, trump), sorted(h1, trump)], attacker, table: [], phase: 'attack', limit: Math.min(HAND, HAND),
    winner: null, durak: null, draw: false, bouts: 0, moves: 0,
    note: `${attacker === 0 ? 'You attack' : 'Computer attacks'} first (lowest trump)`,
  }
}

export const isOver = (s: DState) => s.phase === 'over'
export const defender = (s: DState): Who => other(s.attacker)
/** Who has to act now. */
export const toAct = (s: DState): Who | null => (s.phase === 'over' ? null : s.phase === 'defend' ? defender(s) : s.attacker)

export function beats(s: DState, attack: number, defence: number): boolean {
  const t = s.trump
  if (suitOf(defence) === suitOf(attack)) return rankOf(defence) > rankOf(attack)
  return suitOf(defence) === t && suitOf(attack) !== t
}

const ranksOnTable = (s: DState) => new Set(s.table.flatMap((p) => (p.defence === null ? [rankOf(p.attack)] : [rankOf(p.attack), rankOf(p.defence)])))
const undefended = (s: DState) => s.table.flatMap((p, i) => (p.defence === null ? [i] : []))

/** Cards the attacker may lead or add right now. */
export function legalAttacks(s: DState): number[] {
  if (s.phase !== 'attack' && s.phase !== 'take') return []
  if (s.table.length >= s.limit) return []
  const hand = s.hands[s.attacker]
  if (s.table.length === 0) return [...hand]
  const ranks = ranksOnTable(s)
  return hand.filter((c) => ranks.has(rankOf(c)))
}

/** Every (card, attack index) the defender may play. */
export function legalDefences(s: DState): { card: number; index: number }[] {
  if (s.phase !== 'defend') return []
  const out: { card: number; index: number }[] = []
  for (const index of undefended(s)) for (const card of s.hands[defender(s)]) if (beats(s, s.table[index].attack, card)) out.push({ card, index })
  return out
}

/** The attacker may end the bout once everything is beaten, or stop adding after the defender has taken. */
export const canEnd = (s: DState) => (s.phase === 'attack' && s.table.length > 0 && undefended(s).length === 0) || s.phase === 'take'

function drawUp(s: DState, hands: [number[], number[]], deck: number[], first: Who) {
  for (const w of [first, other(first)] as Who[]) while (hands[w].length < HAND && deck.length) hands[w].push(deck.pop()!)
}

/** Ends the bout: the table is discarded or taken, both refill, roles change if the defence held, and the game may end. */
function finishBout(s: DState, taken: boolean): DState {
  const hands: [number[], number[]] = [[...s.hands[0]], [...s.hands[1]]]
  const deck = [...s.deck]
  const def = defender(s)
  const cards = s.table.flatMap((p) => (p.defence === null ? [p.attack] : [p.attack, p.defence]))
  if (taken) hands[def].push(...cards)
  drawUp(s, hands, deck, s.attacker)
  hands[0] = sorted(hands[0], s.trump)
  hands[1] = sorted(hands[1], s.trump)
  const attacker = taken ? s.attacker : def
  const base: DState = { ...s, deck, hands, attacker, table: [], phase: 'attack', bouts: s.bouts + 1, moves: s.moves + 1 }
  if (deck.length === 0) {
    const e0 = hands[0].length === 0
    const e1 = hands[1].length === 0
    if (e0 && e1) return { ...base, phase: 'over', draw: true, note: 'Draw: both hands are empty' }
    if (e0 || e1) {
      const winner: Who = e0 ? 0 : 1
      return { ...base, phase: 'over', winner, durak: other(winner), note: winner === 0 ? 'You are out of cards: you win!' : 'Computer is out of cards: you are the durak' }
    }
  }
  const limit = Math.min(HAND, hands[defender(base)].length)
  const note = taken ? `${def === 0 ? 'You take' : 'Computer takes'} the cards` : `Beaten off: ${def === 0 ? 'you' : 'the computer'} now attack${def === 0 ? '' : 's'}`
  return { ...base, limit, note }
}

/** Ends the bout on its own when nothing more can be added. */
function settle(s: DState): DState {
  if (s.phase === 'attack' && s.table.length > 0 && undefended(s).length === 0 && legalAttacks(s).length === 0) return finishBout(s, false)
  if (s.phase === 'take' && legalAttacks(s).length === 0) return finishBout(s, true)
  return s
}

/** The attacker leads or adds a card. Returns the same object when illegal. */
export function attack(s: DState, who: Who, card: number): DState {
  if (who !== s.attacker || !legalAttacks(s).includes(card)) return s
  const hands: [number[], number[]] = [[...s.hands[0]], [...s.hands[1]]]
  hands[who] = hands[who].filter((c) => c !== card)
  const phase: Phase = s.phase === 'take' ? 'take' : 'defend'
  const next: DState = { ...s, hands, table: [...s.table, { attack: card, defence: null }], phase, moves: s.moves + 1, note: `${who === 0 ? 'You lead' : 'Computer leads'} ${cardName(card)}` }
  // In the take phase the added card is not defended: it joins the cards being taken.
  return phase === 'take' ? settle(next) : next
}

/** The defender beats an attack with a card. With no index it beats the first attack the card can. */
export function defend(s: DState, who: Who, card: number, index?: number): DState {
  if (s.phase !== 'defend' || who !== defender(s)) return s
  const options = legalDefences(s).filter((o) => o.card === card && (index === undefined || o.index === index))
  if (!options.length) return s
  const { index: at } = options[0]
  const hands: [number[], number[]] = [[...s.hands[0]], [...s.hands[1]]]
  hands[who] = hands[who].filter((c) => c !== card)
  const table = s.table.map((p, i) => (i === at ? { ...p, defence: card } : p))
  const open = table.some((p) => p.defence === null)
  const next: DState = { ...s, hands, table, phase: open ? 'defend' : 'attack', moves: s.moves + 1, note: `${who === 0 ? 'You beat' : 'Computer beats'} it with ${cardName(card)}` }
  return open ? next : settle(next)
}

/** The defender gives up and takes the table; the attacker may still add matching cards. */
export function take(s: DState, who: Who): DState {
  if (s.phase !== 'defend' || who !== defender(s)) return s
  return settle({ ...s, phase: 'take', moves: s.moves + 1, note: `${who === 0 ? 'You take' : 'Computer takes'} the cards` })
}

/** The attacker stops adding cards. */
export function done(s: DState, who: Who): DState {
  if (who !== s.attacker || !canEnd(s)) return s
  return finishBout(s, s.phase === 'take')
}

export function isState(v: unknown): v is DState {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Partial<DState>
  const cards = (a: unknown, max: number) => Array.isArray(a) && a.length <= max && a.every((c) => Number.isInteger(c) && c >= 0 && c < 36)
  return typeof s.seed === 'string' && cards(s.deck, 36) && Array.isArray(s.hands) && cards(s.hands[0], 36) && cards(s.hands[1], 36) &&
    Array.isArray(s.table) && (s.attacker === 0 || s.attacker === 1) && ['attack', 'defend', 'take', 'over'].includes(s.phase as string) &&
    Number.isInteger(s.trump) && Number.isInteger(s.limit) && typeof s.draw === 'boolean'
}

/** A win pays more the faster it comes and the more cards the computer is left holding. A draw is worth something. */
export function scoreFor(s: DState): number {
  if (s.winner === 0) return 400 + 20 * s.hands[1].length + Math.max(0, 200 - 4 * s.bouts)
  return s.draw ? 150 : 0
}

// ---- Computer player ----------------------------------------------------------------------------------------------

export type Level = 'easy' | 'normal' | 'hard'

const isTrump = (s: DState, c: number) => suitOf(c) === s.trump
const cost = (s: DState, c: number) => rankOf(c) + (isTrump(s, c) ? 20 : 0)

/** The attacker's card, or 'done' to stop. Lowest card first and trumps kept back; Hard piles on when the defender is weak. */
export function aiAttack(s: DState, who: Who, level: Level, random: () => number): number | 'done' {
  const legal = legalAttacks(s)
  const may = canEnd(s)
  if (!legal.length) return 'done'
  if (level === 'easy') {
    if (may && random() < 0.35) return 'done'
    return legal[Math.floor(random() * legal.length)]
  }
  const best = [...legal].sort((a, b) => cost(s, a) - cost(s, b) || a - b)[0]
  // Adding to a bout is optional: do not spend a trump on it while the deck lasts, and Normal throws in only cheap cards.
  if (s.table.length > 0 && may) {
    if (isTrump(s, best) && s.deck.length > 0) return 'done'
    if (level === 'normal' && !isTrump(s, best) && rankOf(best) > 4 && s.phase === 'attack' && s.hands[who].length > 3) return 'done'
  }
  return best
}

/** The defender's card and which attack to beat, or 'take'. Uses the cheapest card that beats it. */
export function aiDefend(s: DState, who: Who, level: Level, random: () => number): { card: number; index: number } | 'take' {
  const opts = legalDefences(s)
  if (!opts.length) return 'take'
  if (level === 'easy') {
    if (random() < 0.2) return 'take'
    return opts[Math.floor(random() * opts.length)]
  }
  const first = undefended(s)[0]
  const mine = opts.filter((o) => o.index === first)
  if (!mine.length) return 'take'
  const best = [...mine].sort((a, b) => cost(s, a.card) - cost(s, b.card))[0]
  // Rather take a small bout than burn a high trump while there is still a deck to draw from.
  const spend = isTrump(s, best.card) && !isTrump(s, s.table[first].attack)
  if (spend && s.deck.length > 0) {
    const limit = level === 'hard' ? 5 : 6
    const cheapTable = s.table.every((p) => rankOf(p.attack) <= 3)
    if (rankOf(best.card) >= limit || (level === 'hard' && cheapTable && s.table.length <= 2)) return 'take'
  }
  void who
  return best
}
