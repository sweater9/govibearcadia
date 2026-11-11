import { createRandom, shuffle } from '../../lib/rng'

/** Texas Hold'em tournament with play-money chips: everyone starts with 1,000, blinds rise every 8 hands, last player holding chips wins. */
export const START_CHIPS = 1000
export const HANDS_PER_LEVEL = 8
export const LEVELS: readonly (readonly [number, number])[] = [[10, 20], [20, 40], [40, 80], [75, 150], [100, 200], [150, 300], [200, 400], [300, 600]]
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 5
export const SUITS = ['♠', '♥', '♦', '♣'] as const
export const HAND_NAMES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'] as const

/** A card is 0..51: rank = id % 13 + 1 (1 = ace), suit = floor(id / 13). */
const rankOf = (id: number) => { const r = (id % 13) + 1; return r === 1 ? 14 : r }
export const suitOf = (id: number) => Math.floor(id / 13)
export const rankLabel = (id: number) => { const r = rankOf(id); return r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : String(r) }
export const cardName = (id: number) => `${rankLabel(id)}${SUITS[suitOf(id)]}`
export const rankValue = rankOf

const BASE = 15
function score5(cards: number[]): number {
  const ranks = cards.map(rankOf)
  const flush = cards.every((id) => suitOf(id) === suitOf(cards[0]))
  const counts = new Map<number, number>()
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1)
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])
  const unique = [...counts.keys()].sort((a, b) => b - a)
  let straightHigh = 0
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) straightHigh = unique[0]
    else if (unique.join() === '14,5,4,3,2') straightHigh = 5
  }
  let cat: number
  let tb: number[]
  if (straightHigh && flush) { cat = 8; tb = [straightHigh] }
  else if (groups[0][1] === 4) { cat = 7; tb = [groups[0][0], groups[1][0]] }
  else if (groups[0][1] === 3 && groups[1][1] === 2) { cat = 6; tb = [groups[0][0], groups[1][0]] }
  else if (flush) { cat = 5; tb = unique }
  else if (straightHigh) { cat = 4; tb = [straightHigh] }
  else if (groups[0][1] === 3) { cat = 3; tb = groups.map((g) => g[0]) }
  else if (groups[0][1] === 2 && groups[1][1] === 2) { cat = 2; tb = groups.map((g) => g[0]) }
  else if (groups[0][1] === 2) { cat = 1; tb = groups.map((g) => g[0]) }
  else { cat = 0; tb = unique }
  let score = cat
  for (let i = 0; i < 5; i++) score = score * BASE + (tb[i] ?? 0)
  return score
}
/** Best five-card score from five to seven cards (higher is better). */
export function bestScore(cards: number[]): number {
  if (cards.length === 5) return score5(cards)
  let best = -1
  const n = cards.length
  for (let a = 0; a < n - 4; a++) for (let b = a + 1; b < n - 3; b++) for (let c = b + 1; c < n - 2; c++) for (let d = c + 1; d < n - 1; d++) for (let e = d + 1; e < n; e++) {
    const s = score5([cards[a], cards[b], cards[c], cards[d], cards[e]])
    if (s > best) best = s
  }
  return best
}
export const categoryOf = (score: number) => Math.floor(score / BASE ** 5)
export const handName = (score: number) => HAND_NAMES[categoryOf(score)]

export type Player = { chips: number; hole: number[]; folded: boolean; allIn: boolean; bet: number; total: number; out: boolean; acted: boolean; shown: boolean }
export type Win = { seat: number; amount: number; label: string }
export type State = {
  seed: string
  players: Player[]
  board: number[]
  deck: number[]
  button: number
  turn: number
  street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'over'
  currentBet: number
  lastRaise: number
  hand: number
  actions: number
  wins: Win[]
  winner: number | null
  message: string
}
export type Action = { type: 'fold' } | { type: 'check' } | { type: 'call' } | { type: 'raise'; to: number } | { type: 'next' }

export const blindsFor = (hand: number) => LEVELS[Math.min(LEVELS.length - 1, Math.floor((hand - 1) / HANDS_PER_LEVEL))]
export const potOf = (s: State) => s.players.reduce((sum, p) => sum + p.total, 0)
export const toCallFor = (s: State, seat: number) => Math.min(s.players[seat].chips, Math.max(0, s.currentBet - s.players[seat].bet))
export const minRaiseTo = (s: State) => s.currentBet + s.lastRaise
export const maxRaiseTo = (s: State, seat: number) => s.players[seat].bet + s.players[seat].chips

const live = (s: State, from: number, test: (p: Player) => boolean): number => {
  const n = s.players.length
  for (let i = 1; i <= n; i++) { const seat = (from + i) % n; if (test(s.players[seat])) return seat }
  return -1
}
const canAct = (p: Player) => !p.out && !p.folded && !p.allIn

export function newGame(players: number, seed: string): State {
  const base: State = {
    seed, players: Array.from({ length: players }, () => ({ chips: START_CHIPS, hole: [], folded: false, allIn: false, bet: 0, total: 0, out: false, acted: false, shown: false })),
    board: [], deck: [], button: players - 1, turn: 0, street: 'preflop', currentBet: 0, lastRaise: 0, hand: 0, actions: 0, wins: [], winner: null, message: '',
  }
  return startHand(base)
}

function post(p: Player, amount: number): Player {
  const paid = Math.min(p.chips, amount)
  return { ...p, chips: p.chips - paid, bet: p.bet + paid, total: p.total + paid, allIn: p.chips - paid === 0 }
}

function startHand(prev: State): State {
  const hand = prev.hand + 1
  const [sb, bb] = blindsFor(hand)
  let players = prev.players.map((p): Player => ({ ...p, hole: [], folded: p.out, allIn: false, bet: 0, total: 0, acted: false, shown: false }))
  const base: State = { ...prev, players, hand, board: [], street: 'preflop', wins: [], message: '' }
  const button = live(base, prev.button, (p) => !p.out)
  const deck = shuffle(Array.from({ length: 52 }, (_, i) => i), createRandom(`${prev.seed}:h${hand}`))
  let at = 0
  for (let round = 0; round < 2; round++) {
    for (let i = 1; i <= players.length; i++) {
      const seat = (button + i) % players.length
      if (players[seat].out) continue
      const card = deck[at++]
      players = players.map((p, k) => (k === seat ? { ...p, hole: [...p.hole, card] } : p))
    }
  }
  const alive = players.filter((p) => !p.out).length
  const sbSeat = alive === 2 ? button : (() => { for (let i = 1; i <= players.length; i++) { const k = (button + i) % players.length; if (!players[k].out) return k } return button })()
  const bbSeat = (() => { for (let i = 1; i <= players.length; i++) { const k = (sbSeat + i) % players.length; if (!players[k].out) return k } return sbSeat })()
  players = players.map((p, k) => (k === sbSeat ? post(p, sb) : k === bbSeat ? post(p, bb) : p))
  const state: State = { ...base, players, deck: deck.slice(at), button, currentBet: bb, lastRaise: bb, turn: 0 }
  const first = alive === 2 ? sbSeat : live(state, bbSeat, canAct)
  return settleRound({ ...state, turn: first })
}

function nextStreet(s: State): State {
  const street = s.street === 'preflop' ? 'flop' : s.street === 'flop' ? 'turn' : 'river'
  const count = street === 'flop' ? 3 : 1
  const board = [...s.board, ...s.deck.slice(0, count)]
  const players = s.players.map((p) => ({ ...p, bet: 0, acted: false }))
  const next: State = { ...s, street, board, deck: s.deck.slice(count), players, currentBet: 0, lastRaise: blindsFor(s.hand)[1] }
  return settleRound({ ...next, turn: live(next, s.button, canAct) })
}

/** Decides what happens after any change: a hand won by folds, the next street, a run-out of the board, or the next player to act. */
function settleRound(s: State): State {
  const inHand = s.players.filter((p) => !p.out && !p.folded)
  if (inHand.length === 1) return award(s, false)
  const actors = s.players.filter(canAct)
  const over = actors.length === 0 || (actors.length === 1 ? actors[0].bet >= s.currentBet : actors.every((p) => p.acted && p.bet === s.currentBet))
  if (!over) return s
  return s.street === 'river' ? award(s, true) : nextStreet(s)
}

function award(s: State, showdown: boolean): State {
  const players = s.players.map((p) => ({ ...p }))
  const contenders = players.map((p, i) => i).filter((i) => !players[i].out && !players[i].folded)
  const wins: Win[] = []
  const add = (seat: number, amount: number, label: string) => {
    players[seat].chips += amount
    const found = wins.find((w) => w.seat === seat)
    if (found) found.amount += amount
    else wins.push({ seat, amount, label })
  }
  if (!showdown) {
    const seat = contenders[0]
    add(seat, players.reduce((sum, p) => sum + p.total, 0), 'everyone else folded')
  } else {
    const scores = new Map(contenders.map((i) => [i, bestScore([...players[i].hole, ...s.board])]))
    contenders.forEach((i) => (players[i].shown = true))
    const levels = [...new Set(contenders.map((i) => players[i].total))].sort((a, b) => a - b)
    let prev = 0
    for (const level of levels) {
      const amount = players.reduce((sum, p) => sum + Math.min(p.total, level) - Math.min(p.total, prev), 0)
      const eligible = contenders.filter((i) => players[i].total >= level)
      const best = Math.max(...eligible.map((i) => scores.get(i)!))
      const winners = eligible.filter((i) => scores.get(i) === best)
      const share = Math.floor(amount / winners.length)
      let rest = amount - share * winners.length
      const order = [...winners].sort((a, b) => ((a - s.button - 1 + players.length) % players.length) - ((b - s.button - 1 + players.length) % players.length))
      for (const seat of order) { add(seat, share + (rest > 0 ? 1 : 0), handName(best)); if (rest > 0) rest-- }
      prev = level
    }
  }
  const pool = players.map((p) => ({ ...p, bet: 0 }))
  return { ...s, players: pool, board: s.board, street: 'showdown', wins, message: '', turn: -1 }
}

export function applyAction(state: State, action: Action): State {
  if (state.street === 'over') return state
  if (action.type === 'next') {
    if (state.street !== 'showdown') return state
    const players = state.players.map((p) => ({ ...p, out: p.out || p.chips === 0 }))
    const left = players.filter((p) => !p.out)
    if (players[0].out || left.length <= 1) {
      const winner = left.length === 1 ? players.indexOf(left[0]) : null
      return { ...state, players, street: 'over', winner, turn: -1 }
    }
    return startHand({ ...state, players, actions: state.actions + 1 })
  }
  if (state.street === 'showdown' || state.turn < 0) return state
  const seat = state.turn
  const p = state.players[seat]
  const toCall = Math.max(0, state.currentBet - p.bet)
  let players = state.players.map((x) => ({ ...x }))
  let currentBet = state.currentBet
  let lastRaise = state.lastRaise
  if (action.type === 'fold') players[seat] = { ...p, folded: true, acted: true }
  else if (action.type === 'check') { if (toCall !== 0) return state; players[seat] = { ...p, acted: true } }
  else if (action.type === 'call') { if (toCall === 0) return state; players[seat] = { ...post(p, toCall), acted: true } }
  else {
    const to = action.to
    if (!Number.isInteger(to) || to <= currentBet || to > p.bet + p.chips) return state
    const full = to - currentBet >= lastRaise
    if (!full && to !== p.bet + p.chips) return state
    players[seat] = { ...post(p, to - p.bet), acted: true }
    if (full) lastRaise = to - currentBet
    currentBet = to
    players = players.map((x, i) => (i === seat ? x : { ...x, acted: x.acted && x.bet === currentBet }))
  }
  const next: State = { ...state, players, currentBet, lastRaise, actions: state.actions + 1, turn: seat }
  const settled = settleRound(next)
  if (settled !== next) return settled
  return { ...next, turn: live(next, seat, canAct) }
}

export const legalActions = (s: State) => {
  if (s.street === 'showdown' || s.street === 'over' || s.turn < 0) return { fold: false, check: false, call: false, raise: false, toCall: 0, min: 0, max: 0 }
  const p = s.players[s.turn]
  const toCall = Math.max(0, s.currentBet - p.bet)
  const max = p.bet + p.chips
  return { fold: true, check: toCall === 0, call: toCall > 0, raise: max > s.currentBet, toCall: Math.min(toCall, p.chips), min: Math.min(minRaiseTo(s), max), max }
}
