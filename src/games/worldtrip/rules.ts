import { createRandom } from '../../lib/rng'
import { BOARD, BOARD_SIZE, CENTRE_COST, GROUPS, HOTEL, SCENIC, isClaimable, type Space } from './board'

export const START_CASH = 1500
export const ALLOWANCE = 150
export const TURN_CHOICES = [12, 20, 30] as const
export const DEFAULT_TURNS = 12
export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 6
/** What it costs to leave the Hotel Stopover early, and the most turns anyone waits there. */
export const HOTEL_FEE = 50
export const HOTEL_TRIES = 3
export const AUCTION_STEP = 10
const MAX_TRADE_STOPS = 8

export type Card = { title: string } & (
  | { gain: number } | { pay: number } | { gate: true } | { fromEach: number } | { toEach: number } | { perCentre: number } | { hotel: true } | { pass: true }
)
/** Travel Cards: small events. */
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
/** Fortune Cards: bigger swings, including the Hotel Stopover and a pass to leave it. */
export const FORTUNE: readonly Card[] = [
  { title: 'Your travel guide becomes a bestseller', gain: 100 },
  { title: 'A medical check before the flight', pay: 80 },
  { title: 'You shout everyone a round. Pay each player', toEach: 25 },
  { title: 'Visitor centre maintenance. Pay per centre you own', perCentre: 40 },
  { title: 'Your flight is cancelled. Go to the Hotel Stopover', hotel: true },
  { title: 'Priority boarding pass. Keep it to leave the Hotel Stopover free', pass: true },
  { title: 'A sponsor covers your fares', gain: 50 },
  { title: 'Lost luggage claim', pay: 60 },
  { title: 'A festival pays you to attend. Collect from each player', fromEach: 30 },
  { title: 'Your photo book sells out', gain: 120 },
]
export const DECKS = { travel: CARDS, fortune: FORTUNE } as const

type Player = {
  cash: number
  position: number
  /** Bankrupt: out of the trip, takes no more turns. */
  out: boolean
  /** Stranded at the Hotel Stopover, and how many rolls have failed to get out. */
  inHotel: boolean
  tries: number
  /** Holds a priority boarding pass that leaves the Hotel Stopover free. */
  pass: boolean
}
export type Holding = { owner: number; centre: boolean; /** Mortgaged: the owner took half the price from the bank and collects no fees until it is redeemed. */ mortgaged?: boolean }
/** A trade: the active player gives `give` stops, the buyer gives `take` stops, and `cash` moves from the buyer to the active player (negative: the other way). */
export type Offer = { buyer: number; give: number[]; take: number[]; cash: number }
/** An auction for a stop its lander passed on. Players bid in turn (`order`, starting after the passer); the last bidder left wins it. */
export type Auction = { space: number; bid: number; leader: number; order: number[]; pos: number; dropped: boolean[] }
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
  /** Doubles rolled in a row this turn, and whether the active player rolls again. */
  doubles: number
  again: boolean
  dice: [number, number] | null
  message: string
  collected: number[][]
}
export type Action =
  | { type: 'roll' | 'buy' | 'skip' | 'accept' | 'decline' | 'end' | 'drop' | 'payout' | 'usepass' }
  | { type: 'upgrade' | 'mortgage' | 'redeem'; space: number }
  | { type: 'bid'; amount: number }
  | { type: 'offer'; offer: Offer }

export const playerName = (i: number) => `Player ${i + 1}`
export const activePlayer = (s: State) => s.turn % s.players.length
export const money = (n: number) => `${n} cr`
export const isTurnsEach = (n: unknown): n is number => TURN_CHOICES.includes(n as never)

export function newGame(count: number, seed: string, turnsEach: number = DEFAULT_TURNS): State {
  return {
    players: Array.from({ length: count }, () => ({ cash: START_CASH, position: 0, out: false, inHotel: false, tries: 0, pass: false })),
    holdings: BOARD.map(() => null),
    turn: 0, turnsEach, phase: 'roll', seed, offer: null, auction: null, traded: false, doubles: 0, again: false, dice: null,
    message: 'Everyone starts at the Departure Gate.', collected: Array.from({ length: count }, () => []),
  }
}

export const feeFor = (space: Space, centre: boolean): number => {
  if (space.kind === 'city') return space.fee * (centre ? 2 : 1)
  if (space.kind === 'airport' || space.kind === 'service') return space.fee
  return 0
}

export const priceOf = (space: Space) => (isClaimable(space) ? space.price : 0)
/** What the bank pays to mortgage a stop (and, with a tenth on top, what it costs to redeem it). */
export const mortgageValue = (space: Space) => Math.floor(priceOf(space) / 2)
export const redeemCost = (space: Space) => Math.ceil(mortgageValue(space) * 1.1)

/** True when the player owns every city in the stop's colour group. */
export function ownsGroup(s: State, player: number, space: number): boolean {
  const sp = BOARD[space]
  if (sp.kind !== 'city') return false
  return GROUPS[sp.group].every((i) => s.holdings[i]?.owner === player)
}
export function canBuildCentre(s: State, player: number, space: number): boolean {
  const sp = BOARD[space]
  const h = s.holdings[space]
  return sp.kind === 'city' && h?.owner === player && !h.centre && ownsGroup(s, player, space) && GROUPS[sp.group].every((i) => !s.holdings[i]?.mortgaged) && s.players[player].cash >= CENTRE_COST[sp.group]
}
/** A stop can be mortgaged while it is unmortgaged and no city in its colour group has a visitor centre. */
export function canMortgage(s: State, player: number, space: number): boolean {
  const sp = BOARD[space]
  const h = s.holdings[space]
  if (!h || h.owner !== player || h.mortgaged || !isClaimable(sp)) return false
  return sp.kind !== 'city' || GROUPS[sp.group].every((i) => !s.holdings[i]?.centre)
}
export function canRedeem(s: State, player: number, space: number): boolean {
  const h = s.holdings[space]
  return !!h && h.owner === player && !!h.mortgaged && s.players[player].cash >= redeemCost(BOARD[space])
}

/**
 * What a visitor pays at a stop right now. A city's fee doubles once its owner holds the whole colour group and doubles again with a visitor centre;
 * airports and travel services charge more for each one the owner holds. A mortgaged stop charges nothing.
 */
export function feeAt(s: State, space: number): number {
  const sp = BOARD[space]
  const h = s.holdings[space]
  if (h?.mortgaged) return 0
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
    return total + (h.mortgaged ? priceOf(sp) - mortgageValue(sp) : priceOf(sp)) + (h.centre && sp.kind === 'city' ? CENTRE_COST[sp.group] : 0)
  }, 0)
  return { cash: s.players[player].cash, value, worth: s.players[player].cash + value }
}
export function standings(s: State) {
  return s.players.map((_, index) => ({ index, ...netWorth(s, index) })).sort((a, b) => b.worth - a.worth)
}

/** Why a trade offer is not allowed, or null when it is. Exported so the screen can explain it. */
export function offerProblem(s: State, seller: number, o: Offer): string | null {
  const buyer = s.players[o.buyer]
  if (!buyer || buyer.out || o.buyer === seller) return 'Pick another player still in the trip.'
  const listOk = (list: unknown) => Array.isArray(list) && list.length <= MAX_TRADE_STOPS && list.every((i) => Number.isInteger(i) && i >= 0 && i < BOARD.length) && new Set(list).size === list.length
  if (!listOk(o.give) || !listOk(o.take) || !Number.isSafeInteger(o.cash)) return 'That trade is not valid.'
  if (o.give.length + o.take.length === 0) return 'Trade at least one stop.'
  if (o.give.some((i) => s.holdings[i]?.owner !== seller || s.holdings[i]?.centre)) return 'You can only give stops you own that have no visitor centre.'
  if (o.take.some((i) => s.holdings[i]?.owner !== o.buyer || s.holdings[i]?.centre)) return 'You can only ask for stops they own that have no visitor centre.'
  if (o.cash > 0 && buyer.cash < o.cash) return 'They do not have enough credits.'
  if (o.cash < 0 && s.players[seller].cash < -o.cash) return 'You do not have enough credits.'
  return null
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
  return { ...s, turn, phase: done ? 'done' : 'roll', traded: false, dice: null, auction: null, offer: null, doubles: 0, again: false, message }
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
  const index = activePlayer(s)
  const random = createRandom(s.doubles ? `${s.seed}:${s.turn}:${s.doubles}` : `${s.seed}:${s.turn}`)
  const dice: [number, number] = [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)]
  const double = dice[0] === dice[1]
  const players = s.players.map((p) => ({ ...p }))
  const holdings = s.holdings.slice()
  const me = players[index]
  const base: State = { ...s, players, holdings, dice, phase: 'manage', again: false }
  const sold: string[] = []
  const worth = (i: number) => {
    const sp = BOARD[i]
    return Math.floor((priceOf(sp) + (holdings[i]?.centre && sp.kind === 'city' ? CENTRE_COST[sp.group] : 0)) / 2)
  }
  /** Pays what is owed. A payer who is short sells their unmortgaged stops back to the bank at half value, cheapest first; returns what is still unpaid. */
  const pay = (amount: number, to?: number) => {
    if (me.cash < amount) {
      const mine = holdings.flatMap((h, i) => (h?.owner === index && !h.mortgaged ? [i] : [])).sort((a, b) => worth(a) - worth(b) || a - b)
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
  /** Out of the trip: whatever is left (mortgaged stops) goes back to the bank. */
  const bust = (text: string): State => {
    me.out = true
    holdings.forEach((h, i) => { if (h?.owner === index) holdings[i] = null })
    return advanceTurn(base, `${text}${soldNote()} ${playerName(index)} cannot cover it and is out of the trip. `)
  }
  const toHotel = (text: string): State => {
    me.position = HOTEL
    me.inHotel = true
    me.tries = 0
    return advanceTurn(base, `${text} Go to the Hotel Stopover. `)
  }
  let lead = ''
  let leftHotel = false
  if (me.inHotel) {
    if (double) { me.inHotel = false; me.tries = 0; leftHotel = true; lead = 'Rolled doubles and checked out of the Hotel Stopover. ' }
    else if (me.tries + 1 >= HOTEL_TRIES) {
      if (pay(HOTEL_FEE) > 0) return bust(`Rolled ${dice.join(' + ')}. Paid ${money(HOTEL_FEE)} to leave the Hotel Stopover.`)
      me.inHotel = false; me.tries = 0
      lead = `No doubles in ${HOTEL_TRIES} tries: paid ${money(HOTEL_FEE)} and checked out of the Hotel Stopover. `
    } else {
      me.tries++
      return advanceTurn(base, `Rolled ${dice.join(' + ')}: no doubles, so still at the Hotel Stopover (${me.tries} of ${HOTEL_TRIES} tries). `)
    }
  }
  const doubles = double && !leftHotel ? s.doubles + 1 : 0
  if (doubles >= 3) return toHotel('Third doubles in a row.')
  base.doubles = doubles
  base.again = doubles > 0
  const far = me.position + dice[0] + dice[1]
  const lap = far >= BOARD_SIZE
  if (lap) me.cash += ALLOWANCE
  me.position = far % BOARD_SIZE
  const space = BOARD[me.position]
  const where = `${lead}Landed on ${space.name}.${lap ? ` Collected the ${money(ALLOWANCE)} travel allowance.` : ''}`
  const next: State = { ...base, message: where }
  /** Settles a payment, or sends the payer out of the trip when even selling everything cannot cover it. */
  const settle = (amount: number, to: number | undefined, label: string): State => {
    const short = pay(amount, to)
    if (short > 0) return bust(`${where} ${label} ${money(amount)}.`)
    return { ...next, message: `${where} ${label} ${money(amount)}.${soldNote()}` }
  }
  if (me.position === SCENIC) return toHotel(`${where} Missed flight.`)
  if (space.kind === 'fee') return settle(space.amount, undefined, 'Paid')
  if (space.kind === 'card') {
    const deck = DECKS[space.deck]
    const c = deck[Math.floor(random() * deck.length)]
    if ('gain' in c) { me.cash += c.gain; return { ...next, message: `${where} ${c.title}. Collect ${money(c.gain)}.` } }
    if ('pay' in c) return settle(c.pay, undefined, `${c.title}. Paid`)
    if ('perCentre' in c) {
      const centres = holdings.filter((h) => h?.owner === index && h.centre).length
      return centres ? settle(c.perCentre * centres, undefined, `${c.title} (${centres}). Paid`) : { ...next, message: `${where} ${c.title}. You own none, so nothing to pay.` }
    }
    if ('toEach' in c) {
      let short = 0
      players.forEach((p, i) => { if (i !== index && !p.out) short += pay(c.toEach, i) })
      if (short > 0) return bust(`${where} ${c.title}.`)
      return { ...next, message: `${where} ${c.title}.${soldNote()}` }
    }
    if ('fromEach' in c) {
      let total = 0
      players.forEach((p, i) => { if (i !== index && !p.out) { const t = Math.min(c.fromEach, p.cash); p.cash -= t; total += t } })
      me.cash += total
      return { ...next, message: `${where} ${c.title}. Collected ${money(total)}.` }
    }
    if ('hotel' in c) return toHotel(`${where} ${c.title}.`)
    if ('pass' in c) {
      if (me.pass) { me.cash += 40; return { ...next, message: `${where} ${c.title}. You already hold one, so collect ${money(40)} instead.` } }
      me.pass = true
      return { ...next, message: `${where} ${c.title}.` }
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
  const due = feeAt(s, me.position)
  if (due === 0) return { ...next, message: `${where} It is mortgaged, so no visitor fee.` }
  return settle(due, holding.owner, `Paid visitor fee to ${playerName(holding.owner)}:`)
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
    const { buyer, give, take, cash } = s.offer
    if (offerProblem(s, index, s.offer)) return { ...s, offer: null, traded: true, message: 'The offer is no longer possible.' }
    const players = s.players.map((p) => ({ ...p }))
    players[buyer].cash -= cash
    players[index].cash += cash
    const holdings = s.holdings.slice()
    for (const i of give) holdings[i] = { ...s.holdings[i]!, owner: buyer }
    for (const i of take) holdings[i] = { ...s.holdings[i]!, owner: index }
    let collected = s.collected
    for (const i of give) collected = collectedWith({ ...s, collected }, buyer, i)
    for (const i of take) collected = collectedWith({ ...s, collected }, index, i)
    const names = (list: number[]) => (list.length ? list.map((i) => BOARD[i].name).join(', ') : 'nothing')
    const cashNote = cash === 0 ? '' : cash > 0 ? ` plus ${money(cash)} from ${playerName(buyer)}` : ` and ${money(-cash)} to ${playerName(buyer)}`
    return { ...s, offer: null, traded: true, players, holdings, collected, phase: 'manage',
      message: `Trade done: ${playerName(index)} gave ${names(give)}${cashNote}; ${playerName(buyer)} gave ${names(take)}.` }
  }
  if (s.phase === 'roll' && me.inHotel) {
    if (action.type === 'payout' && me.cash >= HOTEL_FEE) {
      const players = s.players.map((p, i) => (i === index ? { ...p, cash: p.cash - HOTEL_FEE, inHotel: false, tries: 0 } : p))
      return { ...s, players, message: `Paid ${money(HOTEL_FEE)} to leave the Hotel Stopover. Roll to move.` }
    }
    if (action.type === 'usepass' && me.pass) {
      const players = s.players.map((p, i) => (i === index ? { ...p, pass: false, inHotel: false, tries: 0 } : p))
      return { ...s, players, message: 'Used the priority boarding pass to leave the Hotel Stopover. Roll to move.' }
    }
  }
  if ((s.phase === 'roll' || s.phase === 'manage') && (action.type === 'mortgage' || action.type === 'redeem')) {
    const space = BOARD[action.space]
    if (!space) return s
    const holdings = s.holdings.slice()
    if (action.type === 'mortgage') {
      if (!canMortgage(s, index, action.space)) return s
      holdings[action.space] = { ...s.holdings[action.space]!, mortgaged: true }
      const players = s.players.map((p, i) => (i === index ? { ...p, cash: p.cash + mortgageValue(space) } : p))
      return { ...s, holdings, players, message: `Mortgaged ${space.name} for ${money(mortgageValue(space))}.` }
    }
    if (!canRedeem(s, index, action.space)) return s
    holdings[action.space] = { ...s.holdings[action.space]!, mortgaged: false }
    const players = s.players.map((p, i) => (i === index ? { ...p, cash: p.cash - redeemCost(space) } : p))
    return { ...s, holdings, players, message: `Redeemed ${space.name} for ${money(redeemCost(space))}.` }
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
  if (action.type === 'end') {
    if (s.again) return { ...s, phase: 'roll', again: false, dice: null, traded: false, message: `${playerName(index)} rolled doubles and rolls again.` }
    return advanceTurn(s)
  }
  if (action.type === 'upgrade') {
    if (!canBuildCentre(s, index, action.space)) return s
    const space = BOARD[action.space]
    if (space.kind !== 'city') return s
    const players = s.players.map((p, i) => (i === index ? { ...p, cash: p.cash - CENTRE_COST[space.group] } : p))
    return setHolding(s, action.space, { owner: index, centre: true }, players, `Built a visitor centre in ${space.name}.`)
  }
  if (action.type === 'offer' && !s.traded) {
    if (offerProblem(s, index, action.offer)) return s
    return { ...s, offer: action.offer }
  }
  return s
}

/**
 * A traveller who left the room (online only). They are out of the trip and their stops go back to the bank. Whatever
 * they were holding up is cleared: their turn passes on, their bids in an auction are void, and an offer to them is withdrawn.
 * The trip ends when only one traveller is left.
 */
export function removePlayer(s: State, index: number): State {
  if (s.phase === 'done' || !s.players[index] || s.players[index].out) return s
  const players = s.players.map((p, i) => (i === index ? { ...p, out: true, inHotel: false, cash: 0 } : p))
  const holdings = s.holdings.map((h) => (h?.owner === index ? null : h))
  const lead = `${playerName(index)} left the trip. `
  const base: State = { ...s, players, holdings }
  if (activePlayer(s) === index) return advanceTurn(base, lead)
  if (players.filter((p) => !p.out).length <= 1) return { ...base, phase: 'done', auction: null, offer: null, message: `${lead}${playerName(players.findIndex((p) => !p.out))} is the last traveller standing.` }
  if (s.auction) {
    const a = s.auction
    const dropped = a.dropped.slice()
    dropped[index] = true
    const voided = a.leader === index
    return progress(base, { ...a, dropped, leader: voided ? -1 : a.leader, bid: voided ? 0 : a.bid }, a.order[a.pos] === index ? a.pos + 1 : a.pos, lead)
  }
  if (s.offer?.buyer === index) return { ...base, offer: null, traded: true, message: `${lead}The offer to them is withdrawn.` }
  return { ...base, message: lead.trim() }
}
