/**
 * Taiwanese Mahjong rules: a pure state machine. The wall is part of the state (shuffled once with a seeded random), so a hand replays
 * identically from its seed. See docs/TAIWANESE_MAHJONG.md for the rule choices and their sources.
 */
import { shuffle, type Random } from '../../lib/rng'
import { scoreWin, type Item, type Meld, type Score, type WinContext } from './scoring'
import { FLOWER_BASE, FLOWERS, TYPES, counts, isFlower, isSuited, rankOf } from './tiles'

export type Config = {
  /** 'single' plays one hand; 'east' plays the East round: every seat deals once (more if the dealer keeps winning or draws). */
  match: 'single' | 'east'
  /** A win pays `base + unit * tai`. */
  base: number
  unit: number
  /** Points each player starts with. */
  start: number
}
export const DEFAULT_CONFIG: Config = { match: 'east', base: 30, unit: 10, start: 1000 }

export const SEATS = 4
export const LIVE_RESERVE = 16 // the last 16 tiles of the wall are never drawn from the front
export const HAND = 16

export type SeatState = { hand: number[]; melds: Meld[]; flowers: number[]; discards: number[] }
export type Options = { win: boolean; pung: boolean; kong: boolean; /** Lowest tile of each chow that could be made. */ chows: number[] }
export type Decision = { type: 'pass' } | { type: 'win' } | { type: 'pung' } | { type: 'kong' } | { type: 'chow'; low: number }
export type Phase = 'discard' | 'claim' | 'hand-over' | 'over'

export type HandResult =
  | { kind: 'win'; winner: number; from: number | null; selfDraw: boolean; tai: number; items: Item[]; /** Extra tai per payer for the dealer. */ dealerTai: number; deltas: number[] }
  | { kind: 'draw'; deltas: number[] }

export type Event =
  | { kind: 'flower'; seat: number; tile: number }
  | { kind: 'discard'; seat: number; tile: number }
  | { kind: 'chow' | 'pung' | 'kong' | 'concealed-kong' | 'added-kong'; seat: number; tile: number; from?: number }
  | { kind: 'win'; seat: number; from: number | null }
  | { kind: 'draw-game' }

export type State = {
  config: Config
  wall: number[]
  /** Next tile to draw from the front, and how many have been taken from the back (replacements). */
  next: number
  back: number
  seats: SeatState[]
  dealer: number
  /** Consecutive hands the dealer has kept the deal. */
  lian: number
  handNo: number
  /** How many times the deal has passed on. */
  dealerTurns: number
  turn: number
  /** The tile the player to move just drew, if any. */
  drawn: number | null
  afterKong: boolean
  last: { tile: number; from: number } | null
  options: Record<number, Options>
  phase: Phase
  scores: number[]
  result: HandResult | null
  events: Event[]
}

export const windOf = (s: State, seat: number) => (seat - s.dealer + SEATS) % SEATS
export const ROUND_WIND = 0
export const liveLeft = (s: State) => s.wall.length - s.back - s.next - LIVE_RESERVE
const dealerTai = (s: State) => 1 + 2 * s.lian

export function buildWall(): number[] {
  const wall: number[] = []
  for (let t = 0; t < TYPES; t++) for (let i = 0; i < 4; i++) wall.push(t)
  for (let f = 0; f < FLOWERS; f++) wall.push(FLOWER_BASE + f)
  return wall
}

const emptySeat = (): SeatState => ({ hand: [], melds: [], flowers: [], discards: [] })
const copy = (s: State): State => ({
  ...s,
  config: { ...s.config },
  wall: s.wall,
  seats: s.seats.map((x) => ({ hand: [...x.hand], melds: x.melds.map((m) => ({ ...m })), flowers: [...x.flowers], discards: [...x.discards] })),
  options: {},
  scores: [...s.scores],
  events: [],
})

export function newMatch(random: Random, config: Partial<Config> = {}): State {
  const c = { ...DEFAULT_CONFIG, ...config }
  const s: State = {
    config: c, wall: [], next: 0, back: 0, seats: [], dealer: 0, lian: 0, handNo: 1, dealerTurns: 0, turn: 0, drawn: null, afterKong: false,
    last: null, options: {}, phase: 'discard', scores: Array(SEATS).fill(c.start), result: null, events: [],
  }
  return dealHand(s, random)
}

/** Shuffle, deal 16 to each seat (the dealer draws a 17th), and replace flowers starting with the dealer. */
function dealHand(prev: State, random: Random): State {
  const s = copy(prev)
  s.wall = shuffle(buildWall(), random)
  s.next = 0
  s.back = 0
  s.seats = Array.from({ length: SEATS }, emptySeat)
  s.result = null
  s.last = null
  s.phase = 'discard'
  for (let i = 0; i < HAND; i++) for (let k = 0; k < SEATS; k++) s.seats[k].hand.push(s.wall[s.next++])
  for (let k = 0; k < SEATS; k++) {
    const seat = (s.dealer + k) % SEATS
    let again = true
    while (again) {
      again = false
      for (const t of [...s.seats[seat].hand]) {
        if (!isFlower(t)) continue
        s.seats[seat].hand.splice(s.seats[seat].hand.indexOf(t), 1)
        s.seats[seat].flowers.push(t)
        s.events.push({ kind: 'flower', seat, tile: t })
        s.seats[seat].hand.push(takeBack(s))
        again = true
      }
    }
  }
  s.turn = s.dealer
  drawFor(s, s.dealer, false)
  return s
}

function takeBack(s: State): number {
  const t = s.wall[s.wall.length - 1 - s.back]
  s.back++
  return t
}

/** The player draws (from the front, or from the back after a kong), revealing and replacing flowers. Ends the hand if it cannot. */
function drawFor(s: State, seat: number, fromBack: boolean) {
  if (!fromBack && liveLeft(s) <= 0) return endDraw(s)
  if (fromBack && liveLeft(s) <= 0) return endDraw(s)
  let t = fromBack ? takeBack(s) : s.wall[s.next++]
  while (isFlower(t)) {
    s.seats[seat].flowers.push(t)
    s.events.push({ kind: 'flower', seat, tile: t })
    if (s.seats[seat].flowers.length === FLOWERS) return endWin(s, seat, null, true, { tai: 8, items: [{ name: 'All flowers', tai: 8 }] })
    if (liveLeft(s) <= 0) return endDraw(s)
    t = takeBack(s)
  }
  s.seats[seat].hand.push(t)
  s.drawn = t
  s.turn = seat
  s.phase = 'discard'
}

function ctxFor(s: State, seat: number, concealed: readonly number[], winTile: number, selfDraw: boolean): WinContext {
  const p = s.seats[seat]
  return { concealed, melds: p.melds, flowers: p.flowers, selfDraw, winTile, afterKong: s.afterKong, seatWind: windOf(s, seat), roundWind: ROUND_WIND }
}

/** The score if the player to move has won with the tile they just drew, else null. */
export function selfDrawScore(s: State, seat = s.turn): Score | null {
  if (s.phase !== 'discard' || s.drawn === null || seat !== s.turn) return null
  return scoreWin(ctxFor(s, seat, counts(s.seats[seat].hand), s.drawn, true))
}

/** What each other seat may do with the discard. */
export function optionsFor(s: State, seat: number, tile: number, from: number): Options {
  const p = s.seats[seat]
  const c = counts(p.hand)
  const withTile = [...c]
  withTile[tile]++
  const win = scoreWin(ctxFor(s, seat, withTile, tile, false)) !== null
  const chows: number[] = []
  if (seat === (from + 1) % SEATS && isSuited(tile)) {
    for (let low = tile - 2; low <= tile; low++) {
      if (low < 0 || Math.floor(low / 9) !== Math.floor(tile / 9) || rankOf(low) > 7) continue
      if ([low, low + 1, low + 2].filter((x) => x !== tile).every((x) => c[x] > 0)) chows.push(low)
    }
  }
  return { win, pung: c[tile] >= 2, kong: c[tile] >= 3 && liveLeft(s) > 0, chows }
}
const hasAny = (o: Options) => o.win || o.pung || o.kong || o.chows.length > 0

export type Action =
  | { type: 'discard'; tile: number }
  | { type: 'tsumo' }
  | { type: 'concealed-kong'; tile: number }
  | { type: 'added-kong'; tile: number }
  | { type: 'decide'; decisions: Record<number, Decision> }
  | { type: 'next-hand' }

export type Outcome = { ok: true; state: State } | { ok: false; reason: string }
const bad = (reason: string): Outcome => ({ ok: false, reason })

/** Tiles of the player to move that could be declared as a concealed kong, and pungs that could be added to. */
export function kongChoices(s: State, seat = s.turn): { concealed: number[]; added: number[] } {
  if (s.phase !== 'discard' || seat !== s.turn || liveLeft(s) <= 0) return { concealed: [], added: [] }
  const p = s.seats[seat]
  const c = counts(p.hand)
  return {
    concealed: c.map((n, t) => (n === 4 ? t : -1)).filter((t) => t >= 0),
    added: p.melds.filter((m) => m.kind === 'pung' && c[m.tile] > 0).map((m) => m.tile),
  }
}

export function act(prev: State, a: Action): Outcome {
  if (a.type === 'next-hand') return bad('use startNextHand')
  const s = copy(prev)
  if (a.type === 'discard') {
    if (s.phase !== 'discard') return bad('not the time to discard')
    const hand = s.seats[s.turn].hand
    const i = hand.indexOf(a.tile)
    if (i < 0) return bad('that tile is not in the hand')
    hand.splice(i, 1)
    s.seats[s.turn].discards.push(a.tile)
    s.last = { tile: a.tile, from: s.turn }
    s.drawn = null
    s.afterKong = false
    s.events.push({ kind: 'discard', seat: s.turn, tile: a.tile })
    s.options = {}
    for (let k = 1; k < SEATS; k++) {
      const seat = (s.turn + k) % SEATS
      const o = optionsFor(s, seat, a.tile, s.turn)
      if (hasAny(o)) s.options[seat] = o
    }
    if (Object.keys(s.options).length) s.phase = 'claim'
    else advance(s)
    return { ok: true, state: s }
  }
  if (a.type === 'tsumo') {
    const sc = selfDrawScore(s)
    if (!sc) return bad('not a winning hand')
    endWin(s, s.turn, null, true, sc)
    return { ok: true, state: s }
  }
  if (a.type === 'concealed-kong' || a.type === 'added-kong') {
    const ch = kongChoices(s)
    if (!(a.type === 'concealed-kong' ? ch.concealed : ch.added).includes(a.tile)) return bad('that kong is not possible')
    const p = s.seats[s.turn]
    if (a.type === 'concealed-kong') {
      p.hand = p.hand.filter((t) => t !== a.tile)
      p.melds.push({ kind: 'kong', tile: a.tile, open: false })
    } else {
      p.hand.splice(p.hand.indexOf(a.tile), 1)
      p.melds.find((m) => m.kind === 'pung' && m.tile === a.tile)!.kind = 'kong'
    }
    s.events.push({ kind: a.type, seat: s.turn, tile: a.tile })
    s.drawn = null
    drawFor(s, s.turn, true)
    s.afterKong = s.phase === 'discard'
    return { ok: true, state: s }
  }
  // decide
  if (s.phase !== 'claim' || !s.last) return bad('nothing to claim')
  const { tile, from } = s.last
  const opts = prev.options
  const order = Array.from({ length: SEATS - 1 }, (_, k) => (from + 1 + k) % SEATS)
  const dec = (seat: number): Decision => a.decisions[seat] ?? { type: 'pass' }
  for (const seat of order) {
    const d = dec(seat)
    const o = opts[seat]
    if (d.type === 'pass') continue
    if (!o) return bad(`seat ${seat} has no claim`)
    if (d.type === 'win' && !o.win) return bad('that is not a winning hand')
    if (d.type === 'pung' && !o.pung) return bad('cannot pung')
    if (d.type === 'kong' && !o.kong) return bad('cannot kong')
    if (d.type === 'chow' && !o.chows.includes(d.low)) return bad('cannot chow that')
  }
  const winner = order.find((seat) => dec(seat).type === 'win')
  if (winner !== undefined) {
    const sc = scoreWin(ctxFor(s, winner, (() => { const c = counts(s.seats[winner].hand); c[tile]++; return c })(), tile, false))!
    s.seats[from].discards.pop()
    s.seats[winner].hand.push(tile)
    endWin(s, winner, from, false, sc)
    return { ok: true, state: s }
  }
  const meldSeat = order.find((seat) => ['pung', 'kong'].includes(dec(seat).type))
  const chowSeat = order.find((seat) => dec(seat).type === 'chow')
  const seat = meldSeat ?? chowSeat
  if (seat === undefined) {
    advance(s)
    return { ok: true, state: s }
  }
  const d = dec(seat)
  const p = s.seats[seat]
  s.seats[from].discards.pop()
  const take = (t: number, n: number) => {
    for (let i = 0; i < n; i++) p.hand.splice(p.hand.indexOf(t), 1)
  }
  s.last = null
  s.options = {}
  s.turn = seat
  s.drawn = null
  s.afterKong = false
  if (d.type === 'chow') {
    for (const t of [d.low, d.low + 1, d.low + 2]) if (t !== tile) take(t, 1)
    p.melds.push({ kind: 'chow', tile: d.low, open: true })
    s.events.push({ kind: 'chow', seat, tile: d.low, from })
    s.phase = 'discard'
  } else if (d.type === 'pung') {
    take(tile, 2)
    p.melds.push({ kind: 'pung', tile, open: true })
    s.events.push({ kind: 'pung', seat, tile, from })
    s.phase = 'discard'
  } else {
    take(tile, 3)
    p.melds.push({ kind: 'kong', tile, open: true })
    s.events.push({ kind: 'kong', seat, tile, from })
    drawFor(s, seat, true)
    s.afterKong = (s.phase as Phase) === 'discard'
  }
  return { ok: true, state: s }
}

/** No one claimed: the next player draws. */
function advance(s: State) {
  const next = ((s.last?.from ?? s.turn) + 1) % SEATS
  s.options = {}
  s.turn = next
  drawFor(s, next, false)
}

function endDraw(s: State) {
  s.events.push({ kind: 'draw-game' })
  s.result = { kind: 'draw', deltas: Array(SEATS).fill(0) }
  finishHand(s, s.dealer)
}

function endWin(s: State, winner: number, from: number | null, selfDraw: boolean, score: Score) {
  const deltas = Array(SEATS).fill(0)
  const dTai = dealerTai(s)
  const pays = selfDraw ? [0, 1, 2, 3].filter((x) => x !== winner) : [from as number]
  for (const p of pays) {
    const extra = winner === s.dealer || p === s.dealer ? dTai : 0
    const amount = s.config.base + s.config.unit * (score.tai + extra)
    deltas[p] -= amount
    deltas[winner] += amount
  }
  for (let i = 0; i < SEATS; i++) s.scores[i] += deltas[i]
  s.events.push({ kind: 'win', seat: winner, from })
  s.result = { kind: 'win', winner, from, selfDraw, tai: score.tai, items: score.items, dealerTai: dTai, deltas }
  finishHand(s, winner)
}

/** The deal stays after a dealer win or a draw, and passes on after anyone else wins. */
function finishHand(s: State, winner: number) {
  s.drawn = null
  s.options = {}
  const dealerKeeps = s.result?.kind === 'draw' || winner === s.dealer
  if (dealerKeeps) s.lian++
  else {
    s.dealer = (s.dealer + 1) % SEATS
    s.lian = 0
    s.dealerTurns++
  }
  s.phase = s.config.match === 'single' || s.dealerTurns >= SEATS ? 'over' : 'hand-over'
}

export function startNextHand(prev: State, random: Random): State {
  if (prev.phase !== 'hand-over') return prev
  const s = copy(prev)
  s.handNo++
  return dealHand(s, random)
}

/** Every tile is somewhere: wall, hands, melds, flowers, discards. And each seat holds the right number of tiles. */
export function invariantErrors(s: State): string[] {
  const errors: string[] = []
  const phase: Phase = s.phase
  if (phase === 'over' || phase === 'hand-over') return errors
  const all: number[] = []
  const live = s.wall.length - s.back - s.next
  all.push(...s.wall.slice(s.next, s.wall.length - s.back))
  if (live < LIVE_RESERVE - 1) errors.push('wall ran into the reserve')
  s.seats.forEach((p, i) => {
    all.push(...p.hand, ...p.flowers, ...p.discards)
    for (const m of p.melds) all.push(...(m.kind === 'chow' ? [m.tile, m.tile + 1, m.tile + 2] : Array(m.kind === 'kong' ? 4 : 3).fill(m.tile)))
    const slots = p.hand.length + 3 * p.melds.length
    const expect = i === s.turn && phase === 'discard' ? HAND + 1 : HAND
    if (slots !== expect && !(phase === 'discard' && i === s.turn && slots === HAND && s.drawn === null)) errors.push(`seat ${i} holds ${slots} slots, expected ${expect}`)
  })
  const tally = new Array<number>(TYPES + FLOWERS).fill(0)
  for (const t of all) tally[t]++
  for (let t = 0; t < TYPES; t++) if (tally[t] !== 4) errors.push(`tile ${t} appears ${tally[t]} times`)
  for (let t = TYPES; t < TYPES + FLOWERS; t++) if (tally[t] !== 1) errors.push(`flower ${t} appears ${tally[t]} times`)
  return errors
}
