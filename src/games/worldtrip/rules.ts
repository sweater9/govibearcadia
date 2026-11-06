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

type Player = { cash: number; position: number }
export type Holding = { owner: number; centre: boolean }
export type Offer = { space: number; buyer: number; price: number }
export type State = {
  players: Player[]
  holdings: (Holding | null)[]
  turn: number
  turnsEach: number
  phase: 'roll' | 'buy' | 'manage' | 'done'
  seed: string
  offer: Offer | null
  traded: boolean
  dice: [number, number] | null
  message: string
  collected: number[][]
}
export type Action =
  | { type: 'roll' | 'buy' | 'skip' | 'accept' | 'decline' | 'end' }
  | { type: 'upgrade'; space: number }
  | { type: 'offer'; offer: Offer }

export const playerName = (i: number) => `Player ${i + 1}`
export const activePlayer = (s: State) => s.turn % s.players.length
export const money = (n: number) => `${n} cr`
export const isTurnsEach = (n: unknown): n is number => TURN_CHOICES.includes(n as never)

export function newGame(count: number, seed: string, turnsEach: number = DEFAULT_TURNS): State {
  return {
    players: Array.from({ length: count }, () => ({ cash: START_CASH, position: 0 })),
    holdings: BOARD.map(() => null),
    turn: 0, turnsEach, phase: 'roll', seed, offer: null, traded: false, dice: null,
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

function roll(s: State): State {
  const random = createRandom(`${s.seed}:${s.turn}`)
  const dice: [number, number] = [1 + Math.floor(random() * 6), 1 + Math.floor(random() * 6)]
  const index = activePlayer(s)
  const players = s.players.map((p) => ({ ...p }))
  const me = players[index]
  const far = me.position + dice[0] + dice[1]
  const lap = far >= BOARD_SIZE
  if (lap) me.cash += ALLOWANCE
  me.position = far % BOARD_SIZE
  const space = BOARD[me.position]
  const where = `Landed on ${space.name}.${lap ? ` Collected the ${money(ALLOWANCE)} travel allowance.` : ''}`
  const next: State = { ...s, players, dice, phase: 'manage', message: where }
  const pay = (amount: number, to?: number) => {
    const paid = Math.min(amount, me.cash)
    me.cash -= paid
    if (to !== undefined) players[to].cash += paid
    return paid
  }
  if (space.kind === 'fee') return { ...next, message: `${where} Paid ${money(pay(space.amount))}.` }
  if (space.kind === 'card') {
    const c = CARDS[Math.floor(random() * CARDS.length)]
    if ('gain' in c) { me.cash += c.gain; return { ...next, message: `${where} ${c.title}. Collect ${money(c.gain)}.` } }
    if ('pay' in c) return { ...next, message: `${where} ${c.title}. Paid ${money(pay(c.pay))}.` }
    if ('fromEach' in c) {
      let total = 0
      players.forEach((p, i) => { if (i !== index) { const t = Math.min(c.fromEach, p.cash); p.cash -= t; total += t } })
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
  if (!holding) return me.cash >= space.price ? { ...next, phase: 'buy' } : { ...next, message: `${where} You need ${money(space.price)} to claim it.` }
  if (holding.owner === index) return next
  const due = feeFor(space, holding.centre)
  const paid = pay(due, holding.owner)
  return { ...next, message: `${where} Paid ${money(paid)} visitor fee to ${playerName(holding.owner)}${paid < due ? ` (of ${money(due)} due)` : ''}.` }
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
    if (action.type === 'skip') return { ...s, phase: 'manage' }
    if (action.type !== 'buy') return s
    const space = BOARD[me.position]
    if (!isClaimable(space) || s.holdings[me.position] || me.cash < space.price) return s
    const players = s.players.map((p, i) => (i === index ? { ...p, cash: p.cash - space.price } : p))
    return setHolding(s, me.position, { owner: index, centre: false }, players, `Claimed ${space.name} for ${money(space.price)}.`, collectedWith(s, index, me.position))
  }
  if (s.phase !== 'manage') return s
  if (action.type === 'end') {
    const turn = s.turn + 1
    const done = turn === s.turnsEach * s.players.length
    return { ...s, turn, phase: done ? 'done' : 'roll', traded: false, dice: null,
      message: done ? 'The trip is over.' : `Pass the device to ${playerName(turn % s.players.length)}.` }
  }
  if (action.type === 'upgrade') {
    if (!canBuildCentre(s, index, action.space)) return s
    const space = BOARD[action.space]
    if (space.kind !== 'city') return s
    const players = s.players.map((p, i) => (i === index ? { ...p, cash: p.cash - CENTRE_COST[space.group] } : p))
    return setHolding(s, action.space, { owner: index, centre: true }, players, `Built a visitor centre in ${space.name}.`)
  }
  if (action.type === 'offer' && !s.traded) {
    const { space, buyer, price } = action.offer
    if (s.holdings[space]?.owner !== index || buyer === index || !s.players[buyer] || !Number.isSafeInteger(price) || price < 1 || price > s.players[buyer].cash) return s
    return { ...s, offer: action.offer }
  }
  return s
}
