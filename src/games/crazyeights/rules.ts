import { createRandom, shuffle, type Random } from '../../lib/rng'

/**
 * Pure rules for Crazy Eights, for two to four players on a standard 52-card deck. No React or browser APIs, so a
 * server could reuse them to validate moves later.
 *
 * Base rules as implemented:
 *  - Seven cards each for two players, five each for three or four. The next card of the stock starts the discard
 *    pile; a starting eight is buried at the bottom of the stock and another card is turned up instead.
 *  - On your turn play a card that matches the top of the discard pile by suit or by rank. An eight is wild: it can
 *    always be played, and you name the suit the next player must match.
 *  - If you cannot play you must draw. Playing is compulsory when you can (you may not draw to hide a card).
 *  - When the stock runs out the discard pile, except its top card, is shuffled to make a new stock. If there is
 *    nothing left to draw a player who cannot play passes; if every player passes in turn the round is blocked.
 *  - The first player to empty their hand wins the round and scores the points left in the other hands. A blocked
 *    round goes to the player holding the fewest points. A match is played over rounds to a target score.
 *  - Card points: eight 50, king, queen, jack and ten 10, ace 1, every other card its face value.
 *
 * Optional house rules (off by default, chosen before the match starts):
 *  - `drawRule: 'one'`: after drawing one card you pass if it cannot be played (default `'until'` keeps drawing).
 *  - `noEightFinish`: you may not go out with an eight; if an eight is your last card you must draw instead.
 *
 * There are deliberately no action cards (no skip, reverse or draw-two): those belong to other games.
 *
 * A card is 0..51: rank = id % 13 (0 is the ace, 7 the eight, 12 the king), suit = floor(id / 13) (spades, hearts,
 * diamonds, clubs).
 */
export type Suit = 0 | 1 | 2 | 3
export type Level = 'beginner' | 'normal' | 'advanced'
export type DrawRule = 'until' | 'one'
export type Rules = { drawRule: DrawRule; noEightFinish: boolean }
export const DEFAULT_RULES: Rules = { drawRule: 'until', noEightFinish: false }

export const SUITS = ['♠', '♥', '♦', '♣'] as const
export const SUIT_NAMES = ['Spades', 'Hearts', 'Diamonds', 'Clubs'] as const
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const EIGHT = 7
export const rankOf = (id: number) => id % 13
export const suitOf = (id: number): Suit => Math.floor(id / 13) as Suit
export const isEight = (id: number) => rankOf(id) === EIGHT
export const rankLabel = (id: number) => RANKS[rankOf(id)]
export const cardName = (id: number) => `${RANKS[rankOf(id)]}${SUITS[suitOf(id)]}`
export const spokenName = (id: number) => `${RANKS[rankOf(id)]} of ${SUIT_NAMES[suitOf(id)].toLowerCase()}`

export function points(id: number): number {
  const r = rankOf(id)
  if (r === EIGHT) return 50
  if (r === 0) return 1
  return r >= 9 ? 10 : r + 1
}
export const handPoints = (hand: readonly number[]) => hand.reduce((n, c) => n + points(c), 0)

export type CState = {
  seed: string
  players: number
  rules: Rules
  hands: number[][]
  /** Draw pile; cards are drawn from the end. */
  stock: number[]
  /** Discard pile; the last card is the top. */
  discard: number[]
  /** The suit the next card must match (the top card's suit, or the one named after an eight). */
  suit: Suit
  turn: number
  drewThisTurn: number
  /** Consecutive turns passed with nothing to play or draw. */
  passes: number
  winner: number | null
  blocked: boolean
  /** voids[p][s]: player p was seen to draw while suit s was wanted, so probably holds none (public information). */
  voids: boolean[][]
  reshuffles: number
  moves: number
  note: string
}

export const handSize = (players: number) => (players === 2 ? 7 : 5)
export const isOver = (s: CState) => s.winner !== null
export const topCard = (s: CState) => s.discard[s.discard.length - 1]
export const nextSeat = (s: CState, from = s.turn) => (from + 1) % s.players
export const canDraw = (s: CState) => s.stock.length > 0 || s.discard.length > 1

export function newRound(seed: string, players: number, rules: Rules = DEFAULT_RULES, first = 0): CState {
  if (players < 2 || players > 4) throw new Error('Crazy Eights is for two to four players')
  const deck = shuffle(Array.from({ length: 52 }, (_, i) => i), createRandom(`${seed}:deal`))
  const hands: number[][] = Array.from({ length: players }, () => [])
  const n = handSize(players)
  for (let i = 0; i < n * players; i++) hands[i % players].push(deck.pop() as number)
  let starter = deck.pop() as number
  while (isEight(starter)) {
    deck.unshift(starter)
    starter = deck.pop() as number
  }
  const state: CState = {
    seed,
    players,
    rules,
    hands: hands.map(sortHand),
    stock: deck,
    discard: [starter],
    suit: suitOf(starter),
    turn: first % players,
    drewThisTurn: 0,
    passes: 0,
    winner: null,
    blocked: false,
    voids: Array.from({ length: players }, () => [false, false, false, false]),
    reshuffles: 0,
    moves: 0,
    note: '',
  }
  return settle(state)
}

/** Hand in a steady order for display: by suit, then rank. */
export const sortHand = (hand: readonly number[]) => [...hand].sort((a, b) => suitOf(a) - suitOf(b) || rankOf(a) - rankOf(b))

export function isLegal(s: CState, card: number): boolean {
  if (isOver(s) || !s.hands[s.turn].includes(card)) return false
  if (isEight(card)) return !(s.rules.noEightFinish && s.hands[s.turn].length === 1)
  return suitOf(card) === s.suit || rankOf(card) === rankOf(topCard(s))
}

export const legalPlays = (s: CState): number[] => (isOver(s) ? [] : s.hands[s.turn].filter((c) => isLegal(s, c)))

/** The current player has no play and no way to draw: they pass. */
const mustPass = (s: CState) => !isOver(s) && legalPlays(s).length === 0 && !canDraw(s)

/** Plays a card (naming a suit when it is an eight). An illegal move returns the same state unchanged. */
export function play(s: CState, card: number, chosen?: Suit): CState {
  if (!isLegal(s, card)) return s
  if (isEight(card) && !(chosen === 0 || chosen === 1 || chosen === 2 || chosen === 3)) return s
  const who = s.turn
  const hands = s.hands.map((h, i) => (i === who ? h.filter((c) => c !== card) : h))
  const next: CState = {
    ...s,
    hands,
    discard: [...s.discard, card],
    suit: isEight(card) ? (chosen as Suit) : suitOf(card),
    drewThisTurn: 0,
    passes: 0,
    moves: s.moves + 1,
    note: isEight(card) ? `plays ${cardName(card)} and names ${SUIT_NAMES[chosen as Suit]}` : `plays ${cardName(card)}`,
  }
  if (hands[who].length === 0) return { ...next, winner: who }
  return settle({ ...next, turn: nextSeat(s) })
}

/** Draws one card for the current player, who must have no legal play. May pass the turn if it still cannot be played. */
export function draw(s: CState): CState {
  if (isOver(s) || legalPlays(s).length > 0 || !canDraw(s)) return s
  let stock = s.stock
  let discard = s.discard
  let reshuffles = s.reshuffles
  if (stock.length === 0) {
    const top = discard[discard.length - 1]
    stock = shuffle(discard.slice(0, -1), createRandom(`${s.seed}:reshuffle:${reshuffles}`))
    discard = [top]
    reshuffles++
  }
  const card = stock[stock.length - 1]
  const who = s.turn
  const voids = s.voids.map((v, i) => (i === who ? v.map((_, k) => k === s.suit || (s.drewThisTurn > 0 && v[k])) : v))
  const next: CState = {
    ...s,
    stock: stock.slice(0, -1),
    discard,
    reshuffles,
    hands: s.hands.map((h, i) => (i === who ? sortHand([...h, card]) : h)),
    voids,
    drewThisTurn: s.drewThisTurn + 1,
    moves: s.moves + 1,
    note: 'draws a card',
  }
  if (legalPlays(next).length > 0) return next
  // Still nothing to play: keep drawing (the player's next draw) or, under the one-card rule or with an empty stock, pass.
  if (next.rules.drawRule === 'one' || !canDraw(next)) return pass(next)
  return next
}

/** Ends the current player's turn. Counts towards a blocked round when it happens with nothing left to draw. */
function pass(s: CState): CState {
  const passes = s.passes + 1
  const moved: CState = { ...s, passes, turn: nextSeat(s), drewThisTurn: 0, note: `${s.note ? s.note + ' and passes' : 'passes'}` }
  if (passes >= s.players) return blockedRound(moved)
  return settle(moved)
}

/** Skips any player who cannot play or draw; ends the round if everyone is stuck. */
function settle(s: CState): CState {
  let cur = s
  for (let guard = 0; guard < cur.players + 1 && mustPass(cur); guard++) {
    const passes = cur.passes + 1
    cur = { ...cur, passes, turn: nextSeat(cur), drewThisTurn: 0, note: 'passes (nothing to play or draw)' }
    if (passes >= cur.players) return blockedRound(cur)
  }
  return cur
}

function blockedRound(s: CState): CState {
  let best = 0
  s.hands.forEach((h, i) => {
    const b = s.hands[best]
    if (handPoints(h) < handPoints(b) || (handPoints(h) === handPoints(b) && h.length < b.length)) best = i
  })
  return { ...s, winner: best, blocked: true, note: 'The round is blocked' }
}

/** Points the winner scores: everything left in the other hands. */
export function roundPoints(s: CState): number {
  if (s.winner === null) return 0
  return s.hands.reduce((n, h, i) => (i === s.winner ? n : n + handPoints(h)), 0)
}

// ---------------------------------------------------------------- match

export type RoundResult = { round: number; winner: number; points: number; blocked: boolean }
export type Match = {
  seed: string
  players: number
  humans: number
  rules: Rules
  target: number
  scores: number[]
  history: RoundResult[]
  round: CState
  /** The current round's result is already in `scores` and `history`. */
  banked: boolean
  over: boolean
  winner: number | null
}
export const TARGETS = [50, 100, 200] as const

export function startMatch(seed: string, players: number, humans: number, rules: Rules = DEFAULT_RULES, target = 100): Match {
  return { seed, players, humans: Math.max(1, Math.min(humans, players)), rules, target, scores: Array(players).fill(0), history: [], round: newRound(`${seed}:r1`, players, rules, 0), banked: false, over: false, winner: null }
}

/** Banks the finished round into the scores and history; ends the match when someone reaches the target. */
export function finishRound(m: Match): Match {
  const r = m.round
  if (r.winner === null || m.banked) return m
  const pts = roundPoints(r)
  const scores = m.scores.map((n, i) => (i === r.winner ? n + pts : n))
  const history = [...m.history, { round: m.history.length + 1, winner: r.winner, points: pts, blocked: r.blocked }]
  const top = Math.max(...scores)
  const over = top >= m.target
  return { ...m, scores, history, banked: true, over, winner: over ? scores.indexOf(top) : null }
}

/** Deals the next round; the first player rotates. */
export function nextRound(m: Match): Match {
  if (m.over || !m.banked) return m
  const n = m.history.length + 1
  return { ...m, banked: false, round: newRound(`${m.seed}:r${n}`, m.players, m.rules, (n - 1) % m.players) }
}

// ---------------------------------------------------------------- computer

export type Move = { kind: 'play'; card: number; suit?: Suit } | { kind: 'draw' }

const suitCounts = (hand: readonly number[]) => {
  const n = [0, 0, 0, 0]
  for (const c of hand) if (!isEight(c)) n[suitOf(c)]++
  return n
}

/** The suit to name: the one the hand holds most of; the advanced level also prefers one the next player seems to lack. */
function bestSuit(s: CState, rest: readonly number[], level: Level, random: Random): Suit {
  if (level === 'beginner') return Math.floor(random() * 4) as Suit
  const counts = suitCounts(rest)
  const next = nextSeat(s)
  let best: Suit = 0
  let bestV = -Infinity
  for (let k = 0; k < 4; k++) {
    let v = counts[k] * 4 + random() * 0.5
    if (level === 'advanced') {
      if (s.voids[next][k]) v += 9
      if (s.hands[next].length <= 3 && s.voids[next][k]) v += 9
    }
    if (v > bestV) {
      bestV = v
      best = k as Suit
    }
  }
  return best
}

/** The computer's move. Always legal; `draw` only when nothing can be played. */
export function aiMove(s: CState, level: Level, random: Random): Move {
  const plays = legalPlays(s)
  if (!plays.length) return { kind: 'draw' }
  const hand = s.hands[s.turn]
  const rest = (c: number) => hand.filter((x) => x !== c)
  const pick = (c: number): Move => (isEight(c) ? { kind: 'play', card: c, suit: bestSuit(s, rest(c), level, random) } : { kind: 'play', card: c })

  if (level === 'beginner') return pick(plays[Math.floor(random() * plays.length)])

  const normal = plays.filter((c) => !isEight(c))
  if (level === 'normal') {
    if (!normal.length) return pick(plays[0])
    const top = Math.max(...normal.map(points))
    const pool = normal.filter((c) => points(c) === top)
    return pick(pool[Math.floor(random() * pool.length)])
  }

  // Advanced: dump heavy cards, build towards a suit the hand is long in, hurt a player who seems out of a suit,
  // and keep eights as rescues unless going out, or an opponent is about to.
  const next = nextSeat(s)
  const danger = s.players > 1 && s.hands.some((h, i) => i !== s.turn && h.length <= 2)
  let best = plays[0]
  let bestV = -Infinity
  for (const c of plays) {
    const left = rest(c)
    let v = points(c) * 0.4 + random() * 0.3
    if (isEight(c)) {
      v = -35 + (left.length <= 1 ? 90 : 0) + (danger ? 55 : 0) + (normal.length === 0 ? 100 : 0)
    } else {
      const k = suitOf(c)
      v += suitCounts(left)[k] * 4
      if (s.voids[next][k]) v += 10
      if (left.length === 1) v += 12
    }
    if (v > bestV) {
      bestV = v
      best = c
    }
  }
  return pick(best)
}

export function applyMove(s: CState, m: Move): CState {
  return m.kind === 'draw' ? draw(s) : play(s, m.card, m.suit)
}
