import { createRandom, shuffle, type Random } from '../../lib/rng'

/**
 * Pure rules for Slap Pile with one to three computer opponents. No React or browser APIs.
 *
 * Players take turns putting their top card face up on the pile. A face card (J 1, Q 2, K 3, A 4) is a challenge: the
 * next player has that many cards to answer with a face card of their own. If they cannot, the challenger takes the
 * pile. Anyone may slap the pile when it shows a slap pattern and take it; a bad slap burns a card. Players with no
 * cards are out, and whoever ends up with all 52 cards wins.
 *
 * The computer's reaction times are scheduled events on a clock that `advance` moves forward, so a game is exactly
 * repeatable for a given seed and the same inputs at the same times. Player 0 is you.
 */
export type Rules = { pair: boolean; sandwich: boolean; topBottom: boolean; addTen: boolean }
/** Pairs and sandwiches slap; top-and-bottom and add-to-ten are optional house rules and are off. */
export const DEFAULT_RULES: Rules = { pair: true, sandwich: true, topBottom: false, addTen: false }
export type Level = 'easy' | 'normal' | 'hard'
export const PLAY_CAP = 600
export const TICK_MS = 50

export const rankOf = (id: number) => (id % 13) + 1
export const suitOf = (id: number) => Math.floor(id / 13)
/** How many cards the next player gets to answer a face card: J 1, Q 2, K 3, A 4. */
export const chancesOf = (id: number) => ({ 11: 1, 12: 2, 13: 3, 1: 4 })[rankOf(id)] ?? 0
export const isFace = (id: number) => chancesOf(id) > 0

/** The pattern on top of the pile that makes it slappable, or null. */
export function slapPattern(pile: readonly number[], rules: Rules = DEFAULT_RULES): string | null {
  const n = pile.length
  if (n < 2) return null
  const top = rankOf(pile[n - 1])
  if (rules.pair && rankOf(pile[n - 2]) === top) return 'pair'
  if (rules.sandwich && n >= 3 && rankOf(pile[n - 3]) === top) return 'sandwich'
  if (rules.topBottom && rankOf(pile[0]) === top) return 'top and bottom'
  if (rules.addTen && top <= 9 && rankOf(pile[n - 2]) <= 9 && top + rankOf(pile[n - 2]) === 10) return 'adds to ten'
  return null
}
export const slappable = (pile: readonly number[], rules: Rules = DEFAULT_RULES) => slapPattern(pile, rules) !== null

/** Reaction and thinking times (ms), how often the computer misses a real slap, and how often it slaps by mistake. */
export const TIMING: Record<Level, { think: [number, number]; react: [number, number]; miss: number; falseSlap: number }> = {
  easy: { think: [800, 1300], react: [1100, 1800], miss: 0.25, falseSlap: 0.04 },
  normal: { think: [550, 900], react: [700, 1150], miss: 0.12, falseSlap: 0.02 },
  hard: { think: [380, 650], react: [450, 800], miss: 0.04, falseSlap: 0.01 },
}

export type RState = {
  n: number
  /** Each hand is a queue: the next card to play is at index 0, winnings go on the end. */
  hands: number[][]
  /** The pile; the last card is the top. */
  pile: number[]
  turn: number
  challenge: { by: number; remaining: number } | null
  /** -1 while the game is on. */
  winner: number
  over: boolean
  capped: boolean
  plays: number
  t: number
  level: Level
  rules: Rules
  playAt: (number | null)[]
  slapAt: (number | null)[]
  pileKey: string
  goodSlaps: number
  badSlaps: number
  note: string
  /** The last slap, so the screen can flash it. `id` changes every slap. */
  lastSlap: { id: number; who: number; ok: boolean } | null
}

const total = (s: RState) => s.hands.reduce((n, h) => n + h.length, 0) + s.pile.length
export { total as cardCount }
const name = (s: RState, who: number) => (who === 0 ? 'You' : s.n === 2 ? 'Computer' : `Computer ${who}`)
const pileKey = (pile: readonly number[]) => `${pile.length}:${pile.slice(-3).join(',')}`

export function newGame(opponents: 1 | 2 | 3 = 1, level: Level = 'normal', seed = 'slap-pile', rules: Rules = DEFAULT_RULES): RState {
  const n = opponents + 1
  const deck = shuffle(Array.from({ length: 52 }, (_, i) => i), createRandom(`${seed}:deal`))
  const hands: number[][] = Array.from({ length: n }, () => [])
  deck.forEach((c, i) => hands[i % n].push(c))
  const s: RState = {
    n, hands, pile: [], turn: 0, challenge: null, winner: -1, over: false, capped: false, plays: 0, t: 0, level, rules,
    playAt: Array(n).fill(null), slapAt: Array(n).fill(null), pileKey: pileKey([]), goodSlaps: 0, badSlaps: 0, note: 'Your turn: play a card', lastSlap: null,
  }
  return s
}

const between = (random: Random, [lo, hi]: [number, number]) => lo + random() * (hi - lo)
const hasCards = (s: RState, i: number) => s.hands[i].length > 0
function nextActive(s: RState, from: number): number {
  for (let k = 1; k <= s.n; k++) {
    const i = (from + k) % s.n
    if (hasCards(s, i)) return i
  }
  return from
}

/** Hands the pile to `who`, on the bottom of their cards. */
function collect(s: RState, who: number): RState {
  const hands = s.hands.map((h) => [...h])
  hands[who] = [...hands[who], ...s.pile]
  return { ...s, hands, pile: [], challenge: null, turn: who }
}

/** Skips players who are out, settles a challenge whose answerer ran out of cards, and ends the game when it is decided. */
function settle(s: RState): RState {
  for (let guard = 0; guard < s.n + 3 && !s.over; guard++) {
    const holders = s.hands.flatMap((h, i) => (h.length ? [i] : []))
    if (holders.length === 1) {
      const w = holders[0]
      const done = collect(s, w)
      return { ...done, over: true, winner: w, note: `${name(s, w)} ${w === 0 ? 'win' : 'wins'}` }
    }
    if (hasCards(s, s.turn)) break
    if (s.challenge && s.challenge.by !== s.turn) s = collect(s, s.challenge.by)
    else s = { ...s, turn: nextActive(s, s.turn) }
  }
  return s
}

/** Called after every change: ends a capped game and plans the computer's next move and slaps on the clock. */
function reschedule(s: RState, random: Random): RState {
  if (!s.over && s.plays >= PLAY_CAP) {
    const best = Math.max(...s.hands.map((h) => h.length))
    const leaders = s.hands.flatMap((h, i) => (h.length === best ? [i] : []))
    return { ...s, over: true, capped: true, winner: leaders.length === 1 ? leaders[0] : -1, note: 'Game called: most cards wins' }
  }
  if (s.over) return { ...s, playAt: s.playAt.map(() => null), slapAt: s.slapAt.map(() => null) }
  const tm = TIMING[s.level]
  const playAt = [...s.playAt]
  const slapAt = [...s.slapAt]
  const key = pileKey(s.pile)
  const changed = key !== s.pileKey
  const real = slappable(s.pile, s.rules)
  for (let i = 1; i < s.n; i++) {
    if (!hasCards(s, i)) {
      playAt[i] = null
      slapAt[i] = null
      continue
    }
    if (s.turn !== i) playAt[i] = null
    else if (playAt[i] === null) playAt[i] = s.t + between(random, tm.think)
    if (changed) {
      slapAt[i] = null
      if (real) {
        if (random() >= tm.miss) slapAt[i] = s.t + between(random, tm.react)
      } else if (random() < tm.falseSlap) slapAt[i] = s.t + between(random, tm.react)
    }
  }
  return { ...s, playAt, slapAt, pileKey: key }
}

/** Player `who` puts their top card on the pile. Returns the same object when it is not their turn. */
export function play(s: RState, who: number, random: Random): RState {
  if (s.over || who !== s.turn || !hasCards(s, who)) return s
  const hands = s.hands.map((h) => [...h])
  const card = hands[who].shift()!
  const pile = [...s.pile, card]
  let next: RState = { ...s, hands, pile, plays: s.plays + 1, lastSlap: s.lastSlap }
  let note = `${name(s, who)} ${who === 0 ? 'play' : 'plays'}`
  if (isFace(card)) {
    next = { ...next, challenge: { by: who, remaining: chancesOf(card) }, turn: nextActive(next, who) }
    note += ` a face card: ${name(next, next.turn)} ${next.turn === 0 ? 'have' : 'has'} ${chancesOf(card)} ${chancesOf(card) === 1 ? 'chance' : 'chances'}`
  } else if (s.challenge) {
    const remaining = s.challenge.remaining - 1
    if (remaining === 0) {
      next = collect(next, s.challenge.by)
      note = `${name(s, s.challenge.by)} ${s.challenge.by === 0 ? 'win' : 'wins'} the pile`
    } else next = { ...next, challenge: { ...s.challenge, remaining }, turn: who }
  } else next = { ...next, turn: nextActive(next, who) }
  return reschedule(settle({ ...next, note }), random)
}

/** Player `who` slaps the pile. A real pattern takes the pile; otherwise one card is burned under the pile. */
export function slap(s: RState, who: number, random: Random): RState {
  if (s.over || !hasCards(s, who)) return s
  const pattern = slapPattern(s.pile, s.rules)
  const id = (s.lastSlap?.id ?? 0) + 1
  if (pattern) {
    const next = collect(s, who)
    return reschedule(settle({ ...next, goodSlaps: s.goodSlaps + (who === 0 ? 1 : 0), lastSlap: { id, who, ok: true }, note: `${name(s, who)} slapped a ${pattern} and ${who === 0 ? 'take' : 'takes'} the pile` }), random)
  }
  const hands = s.hands.map((h) => [...h])
  const burned = hands[who].shift()!
  const pile = [burned, ...s.pile]
  return reschedule(settle({ ...s, hands, pile, badSlaps: s.badSlaps + (who === 0 ? 1 : 0), lastSlap: { id, who, ok: false }, note: `${name(s, who)} slapped by mistake and ${who === 0 ? 'burn' : 'burns'} a card` }), random)
}

/** Moves the clock forward and carries out any computer slaps and plays that have come due, slaps first, in time order. */
export function advance(s: RState, dtMs: number, random: Random): RState {
  if (s.over) return s
  let cur: RState = { ...s, t: s.t + dtMs }
  for (let guard = 0; guard < 20 && !cur.over; guard++) {
    let best: { kind: 'slap' | 'play'; who: number; at: number } | null = null
    for (let i = 1; i < cur.n; i++) {
      const sl = cur.slapAt[i]
      if (sl !== null && sl <= cur.t && (!best || sl < best.at)) best = { kind: 'slap', who: i, at: sl }
      const pl = cur.playAt[i]
      if (cur.turn === i && pl !== null && pl <= cur.t && (!best || pl < best.at || (pl === best.at && best.kind === 'play'))) best = { kind: 'play', who: i, at: pl }
    }
    if (!best) break
    if (best.kind === 'slap') {
      const slapAt = [...cur.slapAt]
      slapAt[best.who] = null
      cur = slap({ ...cur, slapAt }, best.who, random)
    } else cur = play(cur, best.who, random)
  }
  return cur === s ? s : cur
}

export function scoreFor(s: RState): number {
  if (s.winner === 0) return 500 + 150 * (s.n - 1) + Math.max(0, 300 - Math.floor(s.plays / 4))
  return s.hands[0].length * 3
}
