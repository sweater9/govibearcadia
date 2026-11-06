import { createRandom } from '../../lib/rng'

export const ROUNDS = 12
export const UPGRADE = 80
export const START_CASH = 400

type Space =
  | { name: string; kind: 'property'; price: number; rent: number }
  | { name: string; kind: 'gate' | 'event' | 'rest' }

const property = (name: string, price: number, rent: number): Space => ({ name, kind: 'property', price, rent })
export const BOARD: readonly Space[] = [
  { name: 'Market Gate', kind: 'gate' }, property('Flower Lane', 70, 14),
  property('Spice Row', 90, 18), { name: 'Market News', kind: 'event' },
  property('Potters’ Yard', 100, 20), property('Textile Street', 120, 24),
  { name: 'Tea Break', kind: 'rest' }, property('Book Alley', 110, 22),
  property('Silversmith Lane', 150, 30), { name: 'Market News', kind: 'event' },
  property('Sweet Shop Row', 130, 26), property('Basket Market', 80, 16),
  { name: 'Town Square', kind: 'rest' }, property('Lamp Lane', 140, 28),
  { name: 'Market News', kind: 'event' }, property('Festival Plaza', 160, 32),
]

const EVENTS = [
  { title: 'Festival crowds', amount: 45 },
  { title: 'Awning repairs', amount: -30 },
  { title: 'Bulk order', amount: 30 },
  { title: 'Delivery fee', amount: -20 },
]

type Player = { cash: number; position: number }
export type Holding = { owner: number; shop: boolean }
export type Offer = { property: number; buyer: number; price: number }
export type State = {
  players: Player[]
  holdings: (Holding | null)[]
  turn: number
  phase: 'roll' | 'buy' | 'manage' | 'done'
  seed: string
  offer: Offer | null
  traded: boolean
  dice: [number, number] | null
  message: string
}
export type Action =
  | { type: 'roll' | 'buy' | 'skip' | 'accept' | 'decline' | 'end' }
  | { type: 'upgrade'; property: number }
  | { type: 'offer'; offer: Offer }

export const playerName = (i: number) => `Player ${i + 1}`
export const activePlayer = (state: State) => state.turn % state.players.length
export const money = (amount: number) => `₹${amount}`

export function newGame(count: number, seed: string): State {
  return {
    players: Array.from({ length: count }, () => ({ cash: START_CASH, position: 0 })),
    holdings: BOARD.map(() => null),
    turn: 0, phase: 'roll', seed, offer: null, traded: false, dice: null,
    message: 'The market is open.',
  }
}

export const rentFor = (base: number, shop: boolean) => base * (shop ? 2 : 1)

export function standings(state: State) {
  return state.players.map((player, index) => {
    const value = state.holdings.reduce((total, holding, i) => {
      const space = BOARD[i]
      if (holding?.owner !== index || space.kind !== 'property') return total
      return total + space.price + (holding.shop ? UPGRADE : 0)
    }, 0)
    return { index, cash: player.cash, value, worth: player.cash + value }
  }).sort((a, b) => b.worth - a.worth)
}

function roll(state: State): State {
  const random = createRandom(`${state.seed}:${state.turn}`)
  const dice: [number, number] = [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)]
  const index = activePlayer(state)
  const players = state.players.map((player) => ({ ...player }))
  const player = players[index]
  const distance = player.position + dice[0] + dice[1]
  const bonus = distance >= BOARD.length ? 50 : 0
  player.cash += bonus
  player.position = distance % BOARD.length
  const space = BOARD[player.position]
  const holding = state.holdings[player.position]
  const arrival = `Landed on ${space.name}.${bonus ? ' Collected ₹50 at Market Gate.' : ''}`
  const next: State = { ...state, players, dice, phase: 'manage', message: arrival }
  if (space.kind === 'event') {
    const event = EVENTS[Math.floor(random() * EVENTS.length)]
    const amount = Math.max(-player.cash, event.amount)
    player.cash += amount
    return { ...next, message: `${arrival} ${event.title}: ${amount < 0 ? 'paid' : 'cash change'} ${money(Math.abs(amount))}.` }
  }
  if (space.kind !== 'property') return next
  if (!holding && player.cash >= space.price) return { ...next, phase: 'buy' }
  if (!holding) return { ...next, message: `${arrival} You need ${money(space.price)} to buy.` }
  if (holding.owner === index) return next
  const rent = rentFor(space.rent, holding.shop)
  const paid = Math.min(rent, player.cash)
  player.cash -= paid
  players[holding.owner].cash += paid
  return { ...next, message: `${arrival} Paid ${money(paid)} rent to ${playerName(holding.owner)}${paid < rent ? ` (of ${money(rent)} due)` : ''}.` }
}

function changeHolding(state: State, property: number, holding: Holding, players: Player[], message: string): State {
  const holdings = state.holdings.slice()
  holdings[property] = holding
  return { ...state, holdings, players, phase: 'manage', message }
}

export function applyAction(state: State, action: Action): State {
  const index = activePlayer(state)
  const player = state.players[index]
  if (state.offer) {
    if (action.type === 'decline') return { ...state, offer: null, traded: true, message: 'Offer declined.' }
    if (action.type !== 'accept') return state
    const { property, buyer, price } = state.offer
    const players = state.players.map((entry) => ({ ...entry }))
    players[buyer].cash -= price
    players[index].cash += price
    return changeHolding({ ...state, offer: null, traded: true }, property,
      { ...state.holdings[property]!, owner: buyer }, players,
      `${playerName(buyer)} bought ${BOARD[property].name} for ${money(price)}.`)
  }
  if (state.phase === 'roll' && action.type === 'roll') return roll(state)
  if (state.phase === 'buy') {
    if (action.type === 'skip') return { ...state, phase: 'manage' }
    if (action.type !== 'buy') return state
    const space = BOARD[player.position]
    if (space.kind !== 'property' || state.holdings[player.position] || player.cash < space.price) return state
    const players = state.players.map((entry, i) => i === index ? { ...entry, cash: entry.cash - space.price } : entry)
    return changeHolding(state, player.position, { owner: index, shop: false }, players, `Bought ${space.name} for ${money(space.price)}.`)
  }
  if (state.phase !== 'manage') return state
  if (action.type === 'end') {
    const turn = state.turn + 1
    const done = turn === ROUNDS * state.players.length
    return { ...state, turn, phase: done ? 'done' : 'roll', traded: false, dice: null,
      message: done ? 'The market is closed.' : `Pass the device to ${playerName(turn % state.players.length)}.` }
  }
  if (action.type === 'upgrade') {
    const holding = state.holdings[action.property]
    if (holding?.owner !== index || holding.shop || player.cash < UPGRADE) return state
    const players = state.players.map((entry, i) => i === index ? { ...entry, cash: entry.cash - UPGRADE } : entry)
    return changeHolding(state, action.property, { owner: index, shop: true }, players, `Upgraded ${BOARD[action.property].name} to a shop.`)
  }
  if (action.type === 'offer' && !state.traded) {
    const { property, buyer, price } = action.offer
    if (state.holdings[property]?.owner !== index || buyer === index || !state.players[buyer] ||
        !Number.isSafeInteger(price) || price < 1 || price > state.players[buyer].cash) return state
    return { ...state, offer: action.offer }
  }
  return state
}
