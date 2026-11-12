import { createRandom } from '../../lib/rng'
import { BOARD, BOARD_SIZE, CENTRE_COST, GROUPS, isClaimable, type Space } from './board'

export const START_CASH = 1500
export const ALLOWANCE = 150
export const TURN_CHOICES = [12, 20, 30] as const
export const DEFAULT_TURNS = 12

export type Card = { title: string } & ({ gain: number } | { pay: number } | { gate: true } | { fromEach: number })
export const CARDS: readonly Card[] = [
  { title: 'Your photo wins a contest', gain: 40 },
  { title: 'Your suitcase needs repairs', pay: 20 },
  { title: 'A tour guide tips you off to a bargain', gain: 60 },
  { title: 'You miss a connection and rebook', pay: 40 },
  { title: 'Your travel blog gets sponsored', gain: 80 },
  { title: 'A street market tempts you', pay: 50 },
  { title: 'A friendly tailwind. Advance to Departure Gate', gate: true },
  { title: 'Your birthday dinner with new friends. Collect from each player', fromEach: 20 },
  { title: 'You find a forgotten voucher', gain: 30 },
  { title: 'Hotel upgrade fee', pay: 30 },
]

type Player = { cash: number; position: number; /** Bankrupt: out of the trip, takes no more turns. */ out: boolean }
export type Holding = { owner: number; centre: boolean }
export type Offer = { space: number; buyer: number; price: number }
/** An auction for a stop its lander passed on. Players bid in turn (`order`, starting after the passer); the last bidder left wins it. */
export type Auction = { space: number; bid: number; leader: number; order: number[]; pos: number; dropped: boolean[] }
export const AUCTION_STEP = 10
export type State = {
  players: Player[]
  holdings: (Holding | null)[]
  turn: number
  turnsEach: number
  phase: 'roll' | 'buy' | 'auction' | 'manage' | 'done'
  seed: string
  offer: Offer | null
  auction: Auction | null
  traded: boolean
  dice: [number, number] | null
  message: string
  collected: number[][]
}
export type Action =
  | { type: 'roll' | 'buy' | 'skip' | 'accept' | 'decline' | 'end' }
  | { type: 'upgrade'; space: number }
  | { type: 'bid'; amount: number }
  | { type: 'drop' }
  | { type: 'offer'; offer: Offer }

export const playerName = (i: number) => `Player ${i + 1}`
export const activePlayer = (s: State) => s.turn % s.players.length
export const money = (n: number) => `${n} cr`
export const isTurnsEach = (n: unknown): n is number => TURN_CHOICES.includes(n as never)

export function newGame(count: number, seed: string, turnsEach: number = DEFAULT_TURNS): State {
  return {
    players: Array.from({ length: count }, () => ({ cash: START_CASH, position: 0, out: false })),
    holdings: BOARD.map(() => null),
    turn: 0, turnsEach, phase: 'roll', seed, offer: null, auction: null, traded: false, dice: null,
    message: 'Everyone starts at the Departure Gate.', collected: Array.from({ length: count }, () => []),
  }
}

export const feeFor = (space: Space, centre: boolean): number => {
  if (space.kind === 'city') return space.fee * (centre ? 2 : 1)
  if (space.kind === 'airport' || space.kind === 'service') return space.fee
  return 0
}

export const priceOf = (space: Space) => (isClaimable(space) ? space.price : 0)

/** True when the player owns every city in the stop's colour group. */
export function ownsGroup(s: State, player: number, space: number): boolean {
  const sp = BOARD[space]
  if (sp.kind !== 'city') return false
  return GROUPS[sp.group].every((i) => s.holdings[i]?.owner === player)
}
export function canBuildCentre(s: State, player: number, space: number): boolean {
  const sp = BOARD[space]
  const h = s.holdings[space]
  return sp.kind === 'city' && h?.owner === player && !h.centre && ownsGroup(s, player, space) && s.players[player].cash >= CENTRE_COST[sp.group]
}

/**
 * What a visitor pays at a stop right now. A city's fee doubles once its owner holds the whole colour group and doubles again with a visitor centre;
 * airports and travel services charge more for each one the owner holds.
 */
export function feeAt(s: State, space: number): number {
  const sp = BOARD[space]
  const h = s.holdings[space]
  if (sp.kind === 'city') return sp.fee * (h?.centre ? 4 : h && ownsGroup(s, h.owner, space) ? 2 : 1)
  if (sp.kind === 'airport' || sp.kind === 'service') {
    const held = h ? s.holdings.filter((x, i) => x?.owner === h.owner && BOARD[i].kind === sp.kind).length : 1
    return sp.fee * held
  }
  return 0
}

export function netWorth(s: State, player: number): { cash: number; value: number; worth: number } {
  const value = s.holdings.reduce((total, h, i) => {
    if (h?.owner !== player) return total
    const sp = BOARD[i]
    return total + priceOf(sp) + (h.centre && sp.kind === 'city' ? CENTRE_COST[sp.group] : 0)
  }, 0)
  return { cash: s.players[player].cash, value, worth: s.players[player].cash + value }
}
export function standings(s: State) {
  return s.players.map((_, index) => ({ index, ...netWorth(s, index) })).sort((a, b) => b.worth - a.worth)
}

/** Moves play to the next traveller still in the trip, and ends it at the turn limit or when only one traveller is left. */
function advanceTurn(s: State, lead = ''): State {
  const n = s.players.length
  const limit = s.turnsEach * n
  const left = s.players.flatMap((p, i) => (p.out ? [] : [i]))
  let turn = s.turn + 1
  if (left.length > 1) while (s.players[turn % n].out && turn < limit) turn++
  const done = left.length <= 1 || turn >= limit
  const message = !done ? `${lead}Pass the device to ${playerName(turn % n)}.`
    : left.length === 1 ? `${lead}${playerName(left[0])} is the last traveller standing.` : `${lead}The trip is over.`
  return { ...s, turn, phase: done ? 'done' : 'roll', traded: false, dice: null, auction: null, offer: null, message }
}

/** Applies the effect of a bid or a drop: auto-drops anyone who can no longer outbid, then either closes the auction or hands the turn to the next bidder. */
function progress(s: State, a: Auction, from: number, lead: string): State {
  const dropped = a.dropped.slice()
  for (const i of a.order) if (!dropped[i] && i !== a.leader && s.players[i].cash < a.bid + AUCTION_STEP) dropped[i] = true
  const remaining = a.order.filter((i) => !dropped[i])
  const stop = BOARD[a.space].name
  if (remaining.length === 0 || (a.leader !== -1 && remaining.length === 1)) {
    if (a.leader === -1) return { ...s, auction: null, phase: 'manage', message: `${lead}Nobody bid, so ${stop} stays unclaimed.` }
    const players = s.players.map((p, i) => (i === a.leader ? { ...p, cash: p.cash - a.bid } : p))
    return setHolding({ ...s, auction: null }, a.space, { owner: a.leader, centre: false }, players,
      `${lead}${playerName(a.leader)} wins ${stop} at auction for ${money(a.bid)}.`, collectedWith(s, a.leader, a.space))
  }
  let pos = from % a.order.length
  while (dropped[a.order[pos]] || a.order[pos] === a.leader) pos = (pos + 1) % a.order.length
  const next = a.order[pos]
  return { ...s, phase: 'auction', auction: { ...a, dropped, pos },
    message: `${lead}${stop} auction: ${playerName(next)} to bid${a.bid ? ` (top bid ${money(a.bid)} by ${playerName(a.leader)})` : ` (from ${money(AUCTION_STEP)})`}.` }
}

/** A stop nobody claimed on landing goes to auction among the travellers still in the trip, starting with the one after the passer. */
function startAuction(s: State, space: number, lead: string): State {
  const n = s.players.length
  const index = activePlayer(s)
  const order = Array.from({ length: n }, (_, k) => (index + 1 + k) % n).filter((i) => !s.players[i].out)
  return progress(s, { space, bid: 0, leader: -1, order, pos: 0, dropped: s.players.map(() => false) }, 0, lead)
}

function roll(s: State): State {
  const random = createRandom(`${s.seed}:${s.turn}`)
  const dice: [number, number] = [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)]
  const index = activePlayer(s)
  const players = s.players.map((p) => ({ ...p }))
  const holdings = s.holdings.slice()
  const me = players[index]
  const far = me.position + dice[0] + dice[1]
  const lap = far >= BOARD_SIZE
  if (lap) me.cash += ALLOWANCE
  me.position = far % BOARD_SIZE
  const space = BOARD[me.position]
  const where = `Landed on ${space.name}.${lap ? ` Collected the ${money(ALLOWANCE)} travel allowance.` : ''}`
  const next: State = { ...s, players, holdings, dice, phase: 'manage', message: where }
  const sold: string[] = []
  const worth = (i: number) => {
    const sp = BOARD[i]
    return Math.floor((priceOf(sp) + (holdings[i]?.centre && sp.kind === 'city' ? CENTRE_COST[sp.group] : 0)) / 2)
  }
  /** Pays what is owed. A payer who is short sells their stops back to the bank at half value, cheapest first; returns what is still unpaid. */
  const pay = (amount: number, to?: number) => {
    if (me.cash < amount) {
      const mine = holdings.flatMap((h, i) => (h?.owner === index ? [i] : [])).sort((a, b) => worth(a) - worth(b) || a - b)
      for (const i of mine) {
        if (me.cash >= amount) break
        me.cash += worth(i)
        holdings[i] = null
        sold.push(BOARD[i].name)
      }
    }
    const paid = Math.min(amount, me.cash)
    me.cash -= paid
    if (to !== undefined) players[to].cash += paid
    return amount - paid
  }
  const soldNote = () => (sold.length ? ` Sold ${sold.join(', ')} back to the bank at half price to pay.` : '')
  /** Settles a payment, or sends the payer out of the trip when even selling everything cannot cover it. */
  const settle = (amount: number, to: number | undefined, label: string): State => {
    const short = pay(amount, to)
    if (short > 0) {
      me.out = true
      return advanceTurn({ ...next, message: `${where} ${label} ${money(amount)}.${soldNote()} ${playerName(index)} cannot cover it and is out of the trip. ` })
    }
    return { ...next, message: `${where} ${label} ${money(amount)}.${soldNote()}` }
  }
  if (space.kind === 'fee') return settle(space.amount, undefined, 'Paid')
  if (space.kind === 'card') {
    const c = CARDS[Math.floor(random() * CARDS.length)]
    if ('gain' in c) { me.cash += c.gain; return { ...next, message: `${where} ${c.title}. Collect ${money(c.gain)}.` } }
    if ('pay' in c) return settle(c.pay, undefined, `${c.title}. Paid`)
    if ('fromEach' in c) {
      let total = 0
      players.forEach((p, i) => { if (i !== index && !p.out) { const t = Math.min(c.fromEach, p.cash); p.cash -= t; total += t } })
      me.cash += total
      return { ...next, message: `${where} ${c.title}. Collected ${money(total)}.` }
    }
    const lapped = me.position !== 0
    me.position = 0
    me.cash += ALLOWANCE * (lapped ? 1 : 0)
    return { ...next, message: `${where} ${c.title}.${lapped ? ` Collected the ${money(ALLOWANCE)} travel allowance.` : ''}` }
  }
  if (!isClaimable(space)) return next
  const holding = s.holdings[me.position]
  if (!holding) return me.cash >= space.price ? { ...next, phase: 'buy' } : startAuction(next, me.position, `${where} You need ${money(space.price)} to claim it. `)
  if (holding.owner === index) return next
  return settle(feeAt(s, me.position), holding.owner, `Paid visitor fee to ${playerName(holding.owner)}:`)
}

function setHolding(s: State, space: number, holding: Holding, players: Player[], message: string, collected = s.collected): State {
  const holdings = s.holdings.slice()
  holdings[space] = holding
  return { ...s, holdings, players, collected, phase: 'manage', message }
}
const collectedWith = (s: State, player: number, space: number) =>
  s.collected.map((list, i) => (i === player && BOARD[space].kind === 'city' && !list.includes(space) ? [...list, space] : list))

export function applyAction(s: State, action: Action): State {
  const index = activePlayer(s)
  const me = s.players[index]
  if (s.phase === 'done') return s
  if (s.auction) {
    const a = s.auction
    const bidder = a.order[a.pos]
    if (action.type === 'bid') {
      const amount = action.amount
      if (!Number.isSafeInteger(amount) || amount <= a.bid || amount % AUCTION_STEP !== 0 || amount > s.players[bidder].cash) return s
      return progress(s, { ...a, bid: amount, leader: bidder }, a.pos + 1, `${playerName(bidder)} bids ${money(amount)}. `)
    }
    if (action.type === 'drop') {
      const dropped = a.dropped.slice()
      dropped[bidder] = true
      return progress(s, { ...a, dropped }, a.pos + 1, `${playerName(bidder)} drops out. `)
    }
    return s
  }
  if (s.offer) {
    if (action.type === 'decline') return { ...s, offer: null, traded: true, message: 'Offer declined.' }
    if (action.type !== 'accept') return s
    const { space, buyer, price } = s.offer
    const players = s.players.map((p) => ({ ...p }))
    players[buyer].cash -= price
    players[index].cash += price
    return setHolding({ ...s, offer: null, traded: true }, space, { ...s.holdings[space]!, owner: buyer }, players,
      `${playerName(buyer)} bought ${BOARD[space].name} for ${money(price)}.`, collectedWith(s, buyer, space))
  }
  if (s.phase === 'roll' && action.type === 'roll') return roll(s)
  if (s.phase === 'buy') {
    if (action.type === 'skip') return startAuction(s, me.position, `${playerName(index)} passes. `)
    if (action.type !== 'buy') return s
    const space = BOARD[me.position]
    if (!isClaimable(space) || s.holdings[me.position] || me.cash < space.price) return s
    const players = s.players.map((p, i) => (i === index ? { ...p, cash: p.cash - space.price } : p))
    return setHolding(s, me.position, { owner: index, centre: false }, players, `Claimed ${space.name} for ${money(space.price)}.`, collectedWith(s, index, me.position))
  }
  if (s.phase !== 'manage') return s
  if (action.type === 'end') return advanceTurn(s)
  if (action.type === 'upgrade') {
    if (!canBuildCentre(s, index, action.space)) return s
    const space = BOARD[action.space]
    if (space.kind !== 'city') return s
    const players = s.players.map((p, i) => (i === index ? { ...p, cash: p.cash - CENTRE_COST[space.group] } : p))
    return setHolding(s, action.space, { owner: index, centre: true }, players, `Built a visitor centre in ${space.name}.`)
  }
  if (action.type === 'offer' && !s.traded) {
    const { space, buyer, price } = action.offer
    if (s.holdings[space]?.owner !== index || buyer === index || !s.players[buyer] || s.players[buyer].out || !Number.isSafeInteger(price) || price < 1 || price > s.players[buyer].cash) return s
    return { ...s, offer: action.offer }
  }
  return s
}
