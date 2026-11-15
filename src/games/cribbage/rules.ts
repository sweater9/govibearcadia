import { createRandom, shuffle } from '../../lib/rng'

/**
 * Pure rules for two-player cribbage to 121: six-card deal, two cards to the dealer's crib, the cut, pegging to 31,
 * then counting the hands and the crib. No React or browser APIs.
 *
 * Player 0 is you, player 1 is the computer. A card is 0..51: rank = id % 13 + 1 (1 ace, 11 to 13 court),
 * suit = floor(id / 13).
 */
export type Who = 0 | 1
export const GOAL = 121
export const SKUNK = 91
export const rankOf = (id: number) => (id % 13) + 1
export const suitOf = (id: number) => Math.floor(id / 13)
/** Pip value for counting to fifteen and thirty-one. */
export const valueOf = (id: number) => Math.min(10, rankOf(id))
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
export const SUITS = ['♠', '♥', '♦', '♣'] as const
export const cardName = (id: number) => `${RANKS[rankOf(id) - 1]}${SUITS[suitOf(id)]}`
export const other = (w: Who): Who => (w === 0 ? 1 : 0)

// ---- Scoring a hand -----------------------------------------------------------------------------------------------

export type ScoreItem = { label: string; points: number }
export type HandScore = { points: number; items: ScoreItem[] }

export function scoreHand(hand: readonly number[], starter: number, isCrib = false): HandScore {
  const all = [...hand, starter]
  const items: ScoreItem[] = []
  let fifteens = 0
  for (let mask = 1; mask < 1 << all.length; mask++) {
    let sum = 0
    for (let i = 0; i < all.length; i++) if (mask & (1 << i)) sum += valueOf(all[i])
    if (sum === 15) fifteens++
  }
  if (fifteens) items.push({ label: `${fifteens} fifteen${fifteens > 1 ? 's' : ''}`, points: 2 * fifteens })

  const count = Array<number>(14).fill(0)
  for (const c of all) count[rankOf(c)]++
  const pairs = count.reduce((n, k) => n + (k * (k - 1)) / 2, 0)
  if (pairs) items.push({ label: `${pairs} pair${pairs > 1 ? 's' : ''}`, points: 2 * pairs })

  for (let r = 1; r <= 13; ) {
    if (!count[r]) { r++; continue }
    let end = r
    let mult = 1
    while (end <= 13 && count[end]) mult *= count[end++]
    const len = end - r
    if (len >= 3) items.push({ label: mult > 1 ? `${mult} runs of ${len}` : `run of ${len}`, points: len * mult })
    r = end
  }

  const suits = hand.map(suitOf)
  if (hand.length === 4 && suits.every((s) => s === suits[0])) {
    if (suitOf(starter) === suits[0]) items.push({ label: 'flush of 5', points: 5 })
    else if (!isCrib) items.push({ label: 'flush of 4', points: 4 })
  }
  if (hand.some((c) => rankOf(c) === 11 && suitOf(c) === suitOf(starter))) items.push({ label: 'nobs', points: 1 })
  return { points: items.reduce((n, i) => n + i.points, 0), items }
}

// ---- Pegging ------------------------------------------------------------------------------------------------------

/** Points scored by the card just added to the pile (the last element), not counting go or last card. */
export function pegPoints(pile: readonly number[]): { points: number; items: ScoreItem[] } {
  const items: ScoreItem[] = []
  const count = pile.reduce((n, c) => n + valueOf(c), 0)
  if (count === 15) items.push({ label: 'fifteen', points: 2 })
  if (count === 31) items.push({ label: 'thirty-one', points: 2 })
  const ranks = pile.map(rankOf)
  let same = 1
  while (same < ranks.length && ranks[ranks.length - 1 - same] === ranks[ranks.length - 1]) same++
  if (same >= 2) items.push({ label: same === 2 ? 'pair' : same === 3 ? 'pair royal' : 'double pair royal', points: same === 2 ? 2 : same === 3 ? 6 : 12 })
  for (let n = Math.min(ranks.length, 7); n >= 3; n--) {
    const tail = ranks.slice(-n)
    if (new Set(tail).size === n && Math.max(...tail) - Math.min(...tail) === n - 1) {
      items.push({ label: `run of ${n}`, points: n })
      break
    }
  }
  return { points: items.reduce((n, i) => n + i.points, 0), items }
}

// ---- Game state ---------------------------------------------------------------------------------------------------

export type ShowStep = { who: Who; label: string; cards: number[]; score: HandScore }
export type Phase = 'discard' | 'peg' | 'show' | 'over'

export type CState = {
  seed: string
  round: number
  /** Who owns the crib this deal. The other player leads in pegging and counts first. */
  dealer: Who
  /** Cards still in each hand: six while discarding, then the four not yet pegged. */
  hands: [number[], number[]]
  /** The four cards each player kept, for counting after pegging. */
  kept: [number[], number[]]
  crib: number[]
  starter: number
  phase: Phase
  scores: [number, number]
  pile: number[]
  count: number
  turn: Who
  lastPlayer: Who | null
  /** Hand scores for the show, in counting order, and which one is on screen. */
  shows: ShowStep[]
  step: number
  winner: Who | null
  /** What just happened, in words, for the screen reader and the status line. */
  note: string
  moves: number
}

function deal(seed: string, round: number, dealer: Who, scores: [number, number], moves: number): CState {
  const deck = shuffle(Array.from({ length: 52 }, (_, i) => i), createRandom(`${seed}:${round}`))
  const hands: [number[], number[]] = [deck.slice(0, 6).sort((a, b) => a - b), deck.slice(6, 12).sort((a, b) => a - b)]
  return {
    seed, round, dealer, hands, kept: [[], []], crib: [], starter: deck[12], phase: 'discard', scores, pile: [], count: 0,
    turn: other(dealer), lastPlayer: null, shows: [], step: 0, winner: null,
    note: dealer === 0 ? 'You deal: choose two cards for your crib' : 'Computer deals: choose two cards for its crib', moves,
  }
}

export function newGame(seed = 'cribbage'): CState {
  const dealer: Who = createRandom(`${seed}:first`)() < 0.5 ? 0 : 1
  return deal(seed, 1, dealer, [0, 0], 0)
}

export const isOver = (s: CState) => s.phase === 'over'
const sorted = (a: number[]) => [...a].sort((x, y) => x - y)

/** Adds points. The first player to 121 wins on the spot, even in the middle of counting. */
function award(s: CState, who: Who, points: number, note: string): CState {
  if (!points || s.winner !== null) return { ...s, note: note || s.note }
  const scores: [number, number] = [...s.scores]
  scores[who] = Math.min(GOAL, scores[who] + points)
  const next = { ...s, scores, note }
  return scores[who] >= GOAL ? { ...next, phase: 'over', winner: who } : next
}

const canPlay = (s: CState, who: Who) => s.hands[who].some((c) => s.count + valueOf(c) <= 31)

/** Resolves go, last card and new counts until someone has a real choice to make, or pegging is finished. */
function advancePeg(s: CState): CState {
  for (let guard = 0; guard < 20 && s.phase === 'peg'; guard++) {
    if (canPlay(s, s.turn)) return s
    const them = other(s.turn)
    if (canPlay(s, them)) {
      return { ...s, turn: them, note: s.hands[s.turn].length ? `${s.turn === 0 ? 'You say' : 'Computer says'} go` : s.note }
    }
    // Nobody can play: the last player to play scores one for last card (thirty-one was already paid), then a new count.
    const last = s.lastPlayer
    if (last !== null && s.count < 31) s = award(s, last, 1, `${last === 0 ? 'You score' : 'Computer scores'} 1 for last card`)
    if (s.phase !== 'peg') return s
    s = { ...s, pile: [], count: 0, turn: last === null ? s.turn : other(last), lastPlayer: null }
    if (s.hands[0].length === 0 && s.hands[1].length === 0) return startShow(s)
  }
  return s
}

function startShow(s: CState): CState {
  const first = other(s.dealer)
  const shows: ShowStep[] = [
    { who: first, label: first === 0 ? 'Your hand' : "Computer's hand", cards: sorted(s.kept[first]), score: scoreHand(s.kept[first], s.starter) },
    { who: s.dealer, label: s.dealer === 0 ? 'Your hand' : "Computer's hand", cards: sorted(s.kept[s.dealer]), score: scoreHand(s.kept[s.dealer], s.starter) },
    { who: s.dealer, label: s.dealer === 0 ? 'Your crib' : "Computer's crib", cards: sorted(s.crib), score: scoreHand(s.crib, s.starter, true) },
  ]
  return showStep({ ...s, phase: 'show', shows, step: 0, pile: [], count: 0 }, 0)
}

function showStep(s: CState, step: number): CState {
  const sh = s.shows[step]
  const who = sh.who === 0 ? 'You count' : 'Computer counts'
  return award({ ...s, step }, sh.who, sh.score.points, `${who} ${sh.score.points}`)
}

/** Player `who` puts two cards in the crib. Returns the same object when illegal. */
export function discard(s: CState, who: Who, cards: readonly number[]): CState {
  if (s.phase !== 'discard' || s.hands[who].length !== 6 || cards.length !== 2 || cards[0] === cards[1]) return s
  if (!cards.every((c) => s.hands[who].includes(c))) return s
  const hands: [number[], number[]] = [[...s.hands[0]], [...s.hands[1]]]
  hands[who] = hands[who].filter((c) => !cards.includes(c))
  const kept: [number[], number[]] = [[...s.kept[0]], [...s.kept[1]]]
  kept[who] = [...hands[who]]
  const next: CState = { ...s, hands, kept, crib: [...s.crib, ...cards], moves: s.moves + 1 }
  if (hands[0].length === 6 || hands[1].length === 6) return { ...next, note: 'Waiting for the other discard' }
  // Both are in: the cut. A jack turned up gives the dealer two for his heels.
  let cut: CState = { ...next, phase: 'peg', note: `Cut: ${cardName(s.starter)}` }
  if (rankOf(s.starter) === 11) cut = award(cut, s.dealer, 2, `Cut: ${cardName(s.starter)}. ${s.dealer === 0 ? 'You score' : 'Computer scores'} 2 for his heels`)
  return cut.phase === 'peg' ? advancePeg(cut) : cut
}

export const legalCards = (s: CState, who: Who): number[] => (s.phase === 'peg' && s.turn === who ? s.hands[who].filter((c) => s.count + valueOf(c) <= 31) : [])

/** Player `who` plays a card to the pile. Returns the same object when illegal. */
export function play(s: CState, who: Who, card: number): CState {
  if (!legalCards(s, who).includes(card)) return s
  const hands: [number[], number[]] = [[...s.hands[0]], [...s.hands[1]]]
  hands[who] = hands[who].filter((c) => c !== card)
  const pile = [...s.pile, card]
  const count = s.count + valueOf(card)
  const peg = pegPoints(pile)
  const named = peg.items.map((i) => i.label).join(', ')
  let next: CState = { ...s, hands, pile, count, lastPlayer: who, turn: other(who), moves: s.moves + 1 }
  const name = who === 0 ? 'You' : 'Computer'
  next = award(next, who, peg.points, peg.points ? `${name} score ${peg.points}: ${named}` : `${name} play ${cardName(card)}`)
  if (next.phase !== 'peg') return next
  if (count === 31) next = { ...next, pile: [], count: 0, lastPlayer: null }
  return advancePeg(next)
}

/** Moves counting along. After the crib, the next deal begins with the dealer swapped. */
export function next(s: CState): CState {
  if (s.phase !== 'show') return s
  if (s.step < s.shows.length - 1) return showStep(s, s.step + 1)
  const d = deal(s.seed, s.round + 1, other(s.dealer), s.scores, s.moves + 1)
  return d
}

export function isState(v: unknown): v is CState {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Partial<CState>
  const cards = (a: unknown, max: number) => Array.isArray(a) && a.length <= max && a.every((c) => Number.isInteger(c) && c >= 0 && c < 52)
  return typeof s.seed === 'string' && typeof s.round === 'number' && (s.dealer === 0 || s.dealer === 1) &&
    Array.isArray(s.hands) && cards(s.hands[0], 6) && cards(s.hands[1], 6) && Array.isArray(s.kept) && cards(s.kept[0], 4) && cards(s.kept[1], 4) &&
    cards(s.crib, 4) && cards(s.pile, 8) && Number.isInteger(s.starter) && ['discard', 'peg', 'show', 'over'].includes(s.phase as string) &&
    Array.isArray(s.scores) && s.scores.length === 2 && typeof s.count === 'number' && (s.turn === 0 || s.turn === 1)
}

// ---- Result -------------------------------------------------------------------------------------------------------

/** A win pays more the further ahead it ends; a skunk pays extra. A loss is worth the points pegged. */
export function scoreFor(s: CState): number {
  if (s.winner === 0) return 500 + 6 * (GOAL - s.scores[1]) + (s.scores[1] < SKUNK ? 100 : 0)
  return s.scores[0]
}

// ---- Computer player ----------------------------------------------------------------------------------------------

export type Level = 'easy' | 'normal' | 'hard'

const without = (a: number[], x: number[]) => a.filter((c) => !x.includes(c))

/** The two cards to put in the crib: keep the four with the best average count over every possible cut. */
export function aiDiscard(s: CState, who: Who, level: Level, random: () => number): [number, number] {
  const hand = s.hands[who]
  const pairs: [number, number][] = []
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) pairs.push([hand[i], hand[j]])
  if (level === 'easy' && random() < 0.4) return pairs[Math.floor(random() * pairs.length)]
  const unseen = Array.from({ length: 52 }, (_, c) => c).filter((c) => !hand.includes(c))
  const mine = s.dealer === who
  let best = -Infinity
  let pick = pairs[0]
  for (const toss of pairs) {
    const keep = without(hand, toss)
    let total = 0
    for (const cut of unseen) total += scoreHand(keep, cut).points
    let value = total / unseen.length
    if (level !== 'easy') {
      // The crib is worth a little to its owner: fifteens, pairs and fives help, and the opponent should not be fed them.
      const [a, b] = toss
      const sweet = (valueOf(a) + valueOf(b) === 15 ? 2 : 0) + (rankOf(a) === rankOf(b) ? 2 : 0) + (Math.abs(rankOf(a) - rankOf(b)) === 1 ? 0.8 : 0) + (valueOf(a) === 5 || valueOf(b) === 5 ? 0.9 : 0)
      value += (mine ? 1 : -1) * sweet * (level === 'hard' ? 0.9 : 0.6)
    }
    if (value > best + 1e-9) { best = value; pick = toss }
  }
  return pick
}

/** The card to peg: score now if possible, otherwise avoid handing over an easy fifteen or thirty-one. */
export function aiPeg(s: CState, who: Who, level: Level, random: () => number): number {
  const legal = legalCards(s, who)
  if (level === 'easy') {
    let top = legal[0]
    let topPts = -1
    for (const c of legal) {
      const p = random() < 0.35 ? 0 : pegPoints([...s.pile, c]).points
      if (p > topPts) { topPts = p; top = c }
    }
    return top
  }
  let best = -Infinity
  let pick = legal[0]
  for (const c of legal) {
    const pile = [...s.pile, c]
    const count = s.count + valueOf(c)
    let v = pegPoints(pile).points * 10
    if (count === 5 || count === 21) v -= 6
    else if (count === 10 || count === 26) v -= 2
    else if (count === 31) v += 1
    // Keep pairs and cards that can score later when it costs nothing.
    if (level === 'hard' && s.hands[who].some((h) => h !== c && pegPoints([...pile, h]).points > 0 && s.count + valueOf(c) + valueOf(h) <= 31)) v += 1
    v += random() * 0.1
    if (v > best) { best = v; pick = c }
  }
  return pick
}
