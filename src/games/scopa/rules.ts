import { createRandom, shuffle } from '../../lib/rng'

/**
 * Pure rules for two-player Scopa with the 40-card Italian deck: capture a table card of the same value, or cards
 * that add up to it; sweeping the table scores a scopa; most cards, most coins, the seven of coins and primiera
 * score at the end of each hand. First to 11 wins. No React or browser APIs.
 *
 * Player 0 is you, player 1 is the computer. A card is 0..39: suit = floor(id / 10) (0 coins, 1 cups, 2 swords,
 * 3 clubs), rank = id % 10 + 1 (1 to 7, then 8 fante, 9 cavallo, 10 re). A card's value is its rank.
 */
export type Who = 0 | 1
export const GOAL = 11
export const SUIT_NAMES = ['Coins', 'Cups', 'Swords', 'Clubs'] as const
export const suitOf = (id: number) => Math.floor(id / 10)
export const rankOf = (id: number) => (id % 10) + 1
export const SETTEBELLO = 6
export const other = (w: Who): Who => (w === 0 ? 1 : 0)
const RANK_NAMES = ['Ace', '2', '3', '4', '5', '6', '7', 'Fante', 'Cavallo', 'Re']
export const rankLabel = (id: number) => (['A', '2', '3', '4', '5', '6', '7', 'F', 'C', 'R'] as const)[rankOf(id) - 1]
export const cardName = (id: number) => `${RANK_NAMES[rankOf(id) - 1]} of ${SUIT_NAMES[suitOf(id)]}`

/** Primiera values: seven 21, six 18, ace 16, five 15, four 14, three 13, two 12, face cards 10. */
export const primieraValue = (id: number) => [16, 12, 13, 14, 15, 18, 21, 10, 10, 10][rankOf(id) - 1]

export type HandScore = {
  cards: [number, number]
  coins: [number, number]
  /** Who holds the seven of coins. */
  settebello: Who | null
  primiera: [number, number]
  scope: [number, number]
  /** Points scored per player this hand, by category. */
  awards: { cards: Who | null; coins: Who | null; settebello: Who | null; primiera: Who | null }
  points: [number, number]
}

export type SState = {
  seed: string
  round: number
  /** The dealer; the other player moves first. */
  dealer: Who
  draw: number[]
  table: number[]
  hands: [number[], number[]]
  captured: [number[], number[]]
  scope: [number, number]
  lastCapturer: Who | null
  turn: Who
  scores: [number, number]
  phase: 'play' | 'summary' | 'over'
  summary: HandScore | null
  winner: Who | null
  note: string
  moves: number
}

function deal(seed: string, round: number, dealer: Who, scores: [number, number], moves: number): SState {
  const deck = shuffle(Array.from({ length: 40 }, (_, i) => i), createRandom(`${seed}:${round}`))
  return {
    seed, round, dealer, table: deck.slice(0, 4).sort((a, b) => a - b),
    hands: [deck.slice(4, 7).sort((a, b) => a - b), deck.slice(7, 10).sort((a, b) => a - b)],
    draw: deck.slice(10), captured: [[], []], scope: [0, 0], lastCapturer: null, turn: other(dealer), scores,
    phase: 'play', summary: null, winner: null, moves,
    note: dealer === 0 ? 'Computer plays first' : 'You play first',
  }
}

export function newGame(seed = 'scopa'): SState {
  const dealer: Who = createRandom(`${seed}:first`)() < 0.5 ? 0 : 1
  return deal(seed, 1, dealer, [0, 0], 0)
}

export const isOver = (s: SState) => s.phase === 'over'

/**
 * The ways `card` can be played onto `table`. A table card of the same value must be taken (one of them); otherwise
 * any set of table cards that adds up to the value. An empty list of options means the card is dropped on the table.
 */
export function captureOptions(table: readonly number[], card: number): number[][] {
  const r = rankOf(card)
  const same = table.filter((c) => rankOf(c) === r)
  if (same.length) return same.map((c) => [c])
  const out: number[][] = []
  for (let mask = 1; mask < 1 << table.length; mask++) {
    let sum = 0
    const pick: number[] = []
    for (let i = 0; i < table.length; i++)
      if (mask & (1 << i)) {
        sum += rankOf(table[i])
        pick.push(table[i])
      }
    if (sum === r) out.push(pick)
  }
  return out
}

export type Move = { card: number; take: number[] }
export function legalMoves(s: SState): Move[] {
  if (s.phase !== 'play') return []
  return s.hands[s.turn].flatMap((card) => {
    const opts = captureOptions(s.table, card)
    return opts.length ? opts.map((take) => ({ card, take })) : [{ card, take: [] }]
  })
}

/** Counts, primiera and awards for a finished hand. Primiera adds the best card in each suit; a missing suit counts 0. */
export function scoreHand(captured: readonly [readonly number[], readonly number[]], scope: readonly [number, number]): HandScore {
  const cards: [number, number] = [captured[0].length, captured[1].length]
  const coins: [number, number] = [captured[0].filter((c) => suitOf(c) === 0).length, captured[1].filter((c) => suitOf(c) === 0).length]
  const settebello: Who | null = captured[0].includes(SETTEBELLO) ? 0 : captured[1].includes(SETTEBELLO) ? 1 : null
  const prim = (cs: readonly number[]) => [0, 1, 2, 3].reduce((n, su) => n + Math.max(0, ...cs.filter((c) => suitOf(c) === su).map(primieraValue)), 0)
  const primiera: [number, number] = [prim(captured[0]), prim(captured[1])]
  const lead = (a: number, b: number): Who | null => (a > b ? 0 : b > a ? 1 : null)
  const awards = { cards: lead(cards[0], cards[1]), coins: lead(coins[0], coins[1]), settebello, primiera: lead(primiera[0], primiera[1]) }
  const points: [number, number] = [scope[0], scope[1]]
  for (const w of Object.values(awards)) if (w !== null) points[w]++
  return { cards, coins, settebello, primiera, scope: [scope[0], scope[1]], awards, points }
}

function finishHand(s: SState): SState {
  const captured: [number[], number[]] = [[...s.captured[0]], [...s.captured[1]]]
  // Whatever is left on the table goes to the last player to capture.
  if (s.lastCapturer !== null) captured[s.lastCapturer].push(...s.table)
  const summary = scoreHand(captured, s.scope)
  const scores: [number, number] = [s.scores[0] + summary.points[0], s.scores[1] + summary.points[1]]
  const done = (scores[0] >= GOAL || scores[1] >= GOAL) && scores[0] !== scores[1]
  return {
    ...s, captured, table: s.lastCapturer !== null ? [] : s.table, scores, summary,
    phase: done ? 'over' : 'summary', winner: done ? (scores[0] > scores[1] ? 0 : 1) : null,
    note: done ? (scores[0] > scores[1] ? 'You win!' : 'Computer wins') : 'Hand finished',
  }
}

/** Plays `card` for `who`, taking exactly `take` from the table. Returns the same object when illegal. */
export function play(s: SState, who: Who, card: number, take: readonly number[] = []): SState {
  if (s.phase !== 'play' || s.turn !== who || !s.hands[who].includes(card)) return s
  const opts = captureOptions(s.table, card)
  const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((c) => b.includes(c))
  if (opts.length ? !opts.some((o) => same(o, take)) : take.length > 0) return s
  const hands: [number[], number[]] = [[...s.hands[0]], [...s.hands[1]]]
  hands[who] = hands[who].filter((c) => c !== card)
  const captured: [number[], number[]] = [[...s.captured[0]], [...s.captured[1]]]
  const scope: [number, number] = [...s.scope]
  let table = s.table
  let lastCapturer = s.lastCapturer
  const name = who === 0 ? 'You' : 'Computer'
  let note = ''
  if (take.length) {
    table = table.filter((c) => !take.includes(c))
    captured[who].push(card, ...take)
    lastCapturer = who
    note = `${name} take${who === 0 ? '' : 's'} ${take.map(cardName).join(', ')} with ${cardName(card)}`
    // A sweep scores a scopa, except on the very last play of the hand.
    const lastPlay = hands[0].length === 0 && hands[1].length === 0 && s.draw.length === 0
    if (table.length === 0 && !lastPlay) {
      scope[who]++
      note += ': scopa!'
    }
  } else {
    table = [...table, card].sort((a, b) => a - b)
    note = `${name} play${who === 0 ? '' : 's'} ${cardName(card)}`
  }
  let next: SState = { ...s, hands, table, captured, scope, lastCapturer, turn: other(who), note, moves: s.moves + 1 }
  if (hands[0].length === 0 && hands[1].length === 0) {
    if (s.draw.length === 0) return finishHand(next)
    next = { ...next, hands: [s.draw.slice(0, 3).sort((a, b) => a - b), s.draw.slice(3, 6).sort((a, b) => a - b)], draw: s.draw.slice(6) }
  }
  return next
}

/** After a hand summary, deal the next hand with the dealer swapped. */
export function next(s: SState): SState {
  if (s.phase !== 'summary') return s
  return deal(s.seed, s.round + 1, other(s.dealer), s.scores, s.moves + 1)
}

export function isState(v: unknown): v is SState {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Partial<SState>
  const cards = (a: unknown, max: number) => Array.isArray(a) && a.length <= max && a.every((c) => Number.isInteger(c) && c >= 0 && c < 40)
  return typeof s.seed === 'string' && (s.dealer === 0 || s.dealer === 1) && Array.isArray(s.hands) && cards(s.hands[0], 3) && cards(s.hands[1], 3) &&
    cards(s.table, 40) && cards(s.draw, 40) && Array.isArray(s.captured) && cards(s.captured[0], 40) && cards(s.captured[1], 40) &&
    Array.isArray(s.scores) && s.scores.length === 2 && (s.turn === 0 || s.turn === 1) && ['play', 'summary', 'over'].includes(s.phase as string)
}

/** A win pays more the bigger the margin; a loss is worth ten a point. */
export function scoreFor(s: SState): number {
  return s.winner === 0 ? 400 + 40 * Math.max(0, s.scores[0] - s.scores[1]) + 20 * s.scope[0] : 10 * s.scores[0]
}

// ---- Computer player ----------------------------------------------------------------------------------------------

export type Level = 'easy' | 'normal' | 'hard'

/** What a card is worth to hold: coins, sevens and the settebello matter most. */
const keepValue = (c: number) => (c === SETTEBELLO ? 9 : rankOf(c) === 7 ? 3 : rankOf(c) === 6 ? 1.2 : 0.6) + (suitOf(c) === 0 ? 1.5 : 0)

function evaluate(s: SState, m: Move, level: Level): number {
  if (!m.take.length) {
    // Dropping a card: give away the least valuable one, and do not leave a table the opponent can sweep.
    let v = -keepValue(m.card)
    const sum = s.table.reduce((n, c) => n + rankOf(c), 0) + rankOf(m.card)
    if (sum <= 10) {
      if (level === 'hard') {
        const seen = new Set([...s.hands[s.turn], ...s.table, ...s.captured[0], ...s.captured[1], m.card])
        const unseen = Array.from({ length: 40 }, (_, c) => c).filter((c) => !seen.has(c))
        const chance = unseen.filter((c) => rankOf(c) === sum).length / Math.max(1, unseen.length)
        v -= 9 * Math.min(1, chance * 2)
      } else v -= 4
    }
    return v
  }
  const got = [m.card, ...m.take]
  let v = got.reduce((n, c) => n + 1 + keepValue(c), 0)
  if (got.includes(SETTEBELLO)) v += 8
  const left = s.table.length - m.take.length
  const lastPlay = s.hands[0].length + s.hands[1].length === 1 && s.draw.length === 0
  if (left === 0 && !lastPlay) v += 7
  if (level === 'hard' && left > 0) {
    const sum = s.table.filter((c) => !m.take.includes(c)).reduce((n, c) => n + rankOf(c), 0)
    if (sum <= 10) v -= 2
  }
  return v
}

/** The computer's move. Easy plays a random legal move 40% of the time; Normal and Hard weigh captures. */
export function aiMove(s: SState, random: () => number, level: Level = 'normal'): Move | null {
  const moves = legalMoves(s)
  if (!moves.length) return null
  if (level === 'easy' && random() < 0.4) return moves[Math.floor(random() * moves.length)]
  let best = -Infinity
  let pool: Move[] = []
  for (const m of moves) {
    const v = evaluate(s, m, level) + (level === 'easy' ? random() * 3 : 0)
    if (v > best + 1e-9) {
      best = v
      pool = [m]
    } else if (Math.abs(v - best) <= 1e-9) pool.push(m)
  }
  return pool[Math.floor(random() * pool.length)]
}
