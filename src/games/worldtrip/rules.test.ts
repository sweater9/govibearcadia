import { describe, expect, it } from 'vitest'
import { BOARD, BOARD_SIZE, CELLS, CENTRE_COST, GROUPS, GRID, HOTEL, SCENIC } from './board'
import { ALLOWANCE, HOTEL_FEE, applyAction, canBuildCentre, canMortgage, canRedeem, mortgageValue, redeemCost, offerProblem, feeAt, activePlayer, newGame, netWorth, standings, START_CASH, type Action, type State } from './rules'
import { loadMatch, saveMatch } from './save'
import { FORTUNE } from './rules'

const find = (name: string) => BOARD.findIndex((s) => s.name === name)

describe('the board', () => {
  it('has exactly 40 spaces with the right mix', () => {
    expect(BOARD).toHaveLength(BOARD_SIZE)
    const count = (k: string) => BOARD.filter((s) => s.kind === k).length
    expect([count('city'), count('airport'), count('service'), count('card'), count('fee'), count('corner')]).toEqual([22, 4, 2, 6, 2, 4])
    expect(BOARD.filter((s) => s.kind === 'card' && s.deck === 'travel')).toHaveLength(3)
    expect(BOARD.filter((s) => s.kind === 'card' && s.deck === 'fortune')).toHaveLength(3)
  })
  it('follows the printed order on every edge', () => {
    expect(BOARD[0].name).toBe('Departure Gate')
    expect(BOARD[9].name).toBe('San Francisco')
    expect(BOARD[10].name).toBe('Hotel Stopover')
    expect(BOARD[19].name).toBe('London')
    expect(BOARD[20].name).toBe('World Festival')
    expect(BOARD[29].name).toBe('Dubai')
    expect(BOARD[30].name).toBe('Scenic Stopover')
    expect(BOARD[39].name).toBe('Sydney')
  })
  it('lays the track clockwise round an 11x11 outline', () => {
    expect(CELLS[0]).toEqual([GRID - 1, GRID - 1]) // bottom-right
    expect(CELLS[10]).toEqual([GRID - 1, 0]) // bottom-left
    expect(CELLS[20]).toEqual([0, 0]) // top-left
    expect(CELLS[30]).toEqual([0, GRID - 1]) // top-right
    expect(new Set(CELLS.map((c) => c.join(','))).size).toBe(40)
  })
  it('has 8 colour groups of 2 or 3 cities, each along one edge', () => {
    expect(GROUPS).toHaveLength(8)
    for (const g of GROUPS) {
      expect([2, 3]).toContain(g.length)
      expect(new Set(g.map((i) => Math.floor(i / 10))).size).toBe(1)
    }
    expect(GROUPS.flat()).toHaveLength(22)
  })
})

const setup = (positions: number[] = [0, 0]): State => {
  const s = newGame(2, 'test')
  return { ...s, players: s.players.map((p, i) => ({ ...p, position: positions[i] ?? 0 })) }
}
const rollTo = (s: State, target: number) => {
  for (let i = 0; i < 400; i++) {
    const t = { ...s, seed: `s${i}` }
    const r = applyAction(t, { type: 'roll' })
    if (r.players[0].position === target) return { before: t, after: r }
  }
  throw new Error('no seed found')
}

describe('movement and laps', () => {
  it('wraps from space 40 to the start, collecting the allowance', () => {
    const s = { ...setup([38]), players: setup([38]).players }
    const { after } = rollTo(s, 4) // 38 + 6 = 44 -> index 4, passing the gate
    expect(after.players[0].position).toBeLessThan(BOARD_SIZE)
    expect(after.players[0].cash).toBeGreaterThanOrEqual(START_CASH + ALLOWANCE - 100) // allowance in, at most a small fee out
  })
  it('does not pay the allowance without a lap', () => {
    const { before, after } = rollTo(setup([2]), 8)
    expect(after.players[0].position).toBe(8)
    expect(after.message).not.toMatch(/allowance/)
    expect(before.players[0].cash).toBe(START_CASH)
  })
  it('pays the allowance when landing exactly on the Departure Gate', () => {
    const { after } = rollTo(setup([30]), 0)
    expect(after.players[0].cash).toBe(START_CASH + ALLOWANCE)
  })
})

function own(s: State, player: number, ...names: string[]): State {
  const holdings = s.holdings.slice()
  for (const n of names) holdings[find(n)] = { owner: player, centre: false }
  return { ...s, holdings }
}

describe('claims, fees and centres', () => {
  it('lets a player claim a stop and charges others a visitor fee', () => {
    const { after } = rollTo(setup([2]), 6) // Mexico City, 100
    expect(after.phase).toBe('buy')
    const bought = applyAction(after, { type: 'buy' })
    expect(bought.holdings[6]?.owner).toBe(0)
    expect(bought.players[0].cash).toBe(START_CASH - 100)
    const rival = { ...bought, turn: 1, phase: 'roll' as const, players: bought.players.map((p, i) => (i === 1 ? { ...p, position: 0 } : p)) }
    let paid = false
    for (let i = 0; i < 400 && !paid; i++) {
      const r = applyAction({ ...rival, seed: `r${i}` }, { type: 'roll' })
      if (r.players[1].position === 6) { expect(r.players[0].cash).toBe(START_CASH - 100 + 10); paid = true }
    }
    expect(paid).toBe(true)
  })
  it('only allows a visitor centre once the whole group is owned', () => {
    let s = own(setup(), 0, 'Vancouver')
    expect(canBuildCentre(s, 0, find('Vancouver'))).toBe(false)
    s = own(s, 0, 'Toronto')
    expect(canBuildCentre(s, 0, find('Vancouver'))).toBe(true)
    expect(canBuildCentre(s, 1, find('Vancouver'))).toBe(false)
    const state = { ...s, phase: 'manage' as const }
    const built = applyAction(state, { type: 'upgrade', space: find('Vancouver') })
    expect(built.holdings[find('Vancouver')]?.centre).toBe(true)
    expect(built.players[0].cash).toBe(START_CASH - CENTRE_COST[0])
    expect(canBuildCentre(built, 0, find('Vancouver'))).toBe(false)
    expect(applyAction(state, { type: 'upgrade', space: find('Rome') })).toBe(state)
  })
  it('does not allow centres on airports or services', () => {
    const s = { ...own(setup(), 0, 'Pacific Airport', 'Rail Pass'), phase: 'manage' as const }
    expect(applyAction(s, { type: 'upgrade', space: find('Pacific Airport') })).toBe(s)
    expect(applyAction(s, { type: 'upgrade', space: find('Rail Pass') })).toBe(s)
  })
  it('counts printed values and centres in net worth, and ranks with shared wins', () => {
    let s = own(setup(), 0, 'Vancouver', 'Toronto')
    s = applyAction({ ...s, phase: 'manage' }, { type: 'upgrade', space: find('Vancouver') })
    expect(netWorth(s, 0).worth).toBe(START_CASH + 60 + 80)
    expect(standings(newGame(3, 'x')).map((e) => e.worth)).toEqual([START_CASH, START_CASH, START_CASH])
  })
})

describe('trading', () => {
  it('transfers a stop and the money, once per turn', () => {
    const s = { ...own(setup(), 0, 'Lisbon'), phase: 'manage' as const }
    const offered = applyAction(s, { type: 'offer', offer: { buyer: 1, give: [find('Lisbon')], take: [], cash: 200 } })
    expect(offered.offer).not.toBeNull()
    const done = applyAction(offered, { type: 'accept' })
    expect(done.holdings[find('Lisbon')]?.owner).toBe(1)
    expect(done.players[1].cash).toBe(START_CASH - 200)
    expect(done.players[0].cash).toBe(START_CASH + 200)
    expect(applyAction(done, { type: 'offer', offer: { buyer: 0, give: [find('Lisbon')], take: [], cash: 1 } })).toBe(done)
  })
  it('rejects offers the buyer cannot afford, or for stops the seller does not own', () => {
    const s = { ...own(setup(), 0, 'Lisbon'), phase: 'manage' as const }
    expect(applyAction(s, { type: 'offer', offer: { buyer: 1, give: [find('Lisbon')], take: [], cash: START_CASH + 1 } })).toBe(s)
    expect(applyAction(s, { type: 'offer', offer: { buyer: 1, give: [find('Rome')], take: [], cash: 10 } })).toBe(s)
  })
})

describe('a whole match', () => {
  const play = (turnsEach: number, count = 3) => {
    let s = newGame(count, 'full', turnsEach)
    const actions: Action[] = []
    const act = (a: Action) => { const n = applyAction(s, a); if (n !== s) { actions.push(a); s = n } }
    for (let i = 0; i < 5000 && s.phase !== 'done'; i++) {
      if (s.phase === 'roll') act({ type: 'roll' })
      else if (s.phase === 'buy') act({ type: 'buy' })
      else if (s.phase === 'auction') act({ type: 'drop' })
      else act({ type: 'end' })
    }
    return { s, actions }
  }
  it('ends after the chosen number of turns each and ranks the players', () => {
    for (const t of [12, 20, 30]) {
      const { s } = play(t)
      expect(s.phase).toBe('done')
      expect(s.turn).toBeLessThanOrEqual(t * 3)
      expect(standings(s)).toHaveLength(3)
    }
  })
  it('never lets cash go negative', () => {
    const { s } = play(30, 4)
    expect(s.players.every((p) => p.cash >= 0)).toBe(true)
  })
  it('reloads exactly from its save (offline)', () => {
    const store = new Map<string, string>()
    const ls = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }
    Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true })
    const { s, actions } = play(12, 2)
    saveMatch({ state: s, actions, startedAt: 5, computers: 1 })
    const back = loadMatch()
    expect(back?.state).toEqual(s)
    expect(back?.computers).toBe(1)
    store.set('govibearcadia.world-trip.v1', '{"count":2}')
    expect(loadMatch()).toBeNull()
  })
})

describe('auctions', () => {
  const passed = () => {
    const { after } = rollTo(setup([2]), 6) // Mexico City, unowned
    return applyAction(after, { type: 'skip' })
  }
  it('sends a declined stop to auction, starting with the next player', () => {
    const s = passed()
    expect(s.phase).toBe('auction')
    expect(s.auction?.order).toEqual([1, 0])
    expect(s.auction?.space).toBe(6)
  })
  it('goes to the highest bidder, who pays their bid', () => {
    let s = passed()
    s = applyAction(s, { type: 'bid', amount: 30 }) // player 2
    s = applyAction(s, { type: 'bid', amount: 60 }) // player 1 (the one who passed)
    s = applyAction(s, { type: 'drop' }) // player 2
    expect(s.phase).toBe('manage')
    expect(s.holdings[6]?.owner).toBe(0)
    expect(s.players[0].cash).toBe(START_CASH - 60)
    expect(s.auction).toBeNull()
  })
  it('rejects bids that are too low, off-step or beyond the bidder’s credits', () => {
    const s = passed()
    expect(applyAction(s, { type: 'bid', amount: 0 })).toBe(s)
    expect(applyAction(s, { type: 'bid', amount: 15 })).toBe(s)
    expect(applyAction(s, { type: 'bid', amount: START_CASH + 10 })).toBe(s)
    const a = applyAction(s, { type: 'bid', amount: 50 })
    expect(applyAction(a, { type: 'bid', amount: 50 })).toBe(a)
  })
  it('leaves the stop unclaimed when nobody bids', () => {
    let s = passed()
    s = applyAction(s, { type: 'drop' })
    s = applyAction(s, { type: 'drop' })
    expect(s.phase).toBe('manage')
    expect(s.holdings[6]).toBeNull()
  })
  it('auctions a stop the lander cannot afford, and skips bidders who cannot outbid', () => {
    const { after } = rollTo({ ...setup([2]), players: setup([2]).players.map((p, i) => (i === 0 ? { ...p, cash: 50 } : p)) }, 6)
    expect(after.phase).toBe('auction')
    expect(after.auction?.order).toEqual([1, 0])
  })
})

describe('fees that grow', () => {
  it('doubles a city fee for a full colour group, and again with a centre', () => {
    let s = own(setup(), 0, 'Vancouver')
    expect(feeAt(s, find('Vancouver'))).toBe(6)
    s = own(s, 0, 'Toronto')
    expect(feeAt(s, find('Vancouver'))).toBe(12)
    s = { ...s, phase: 'manage' }
    s = applyAction(s, { type: 'upgrade', space: find('Vancouver') })
    expect(feeAt(s, find('Vancouver'))).toBe(24)
  })
  it('charges more for each airport and travel service the owner holds', () => {
    let s = own(setup(), 0, 'Pacific Airport')
    expect(feeAt(s, find('Pacific Airport'))).toBe(50)
    s = own(s, 0, 'Atlantic Airport', 'Europe Airport')
    expect(feeAt(s, find('Pacific Airport'))).toBe(150)
    s = own(s, 0, 'Rail Pass', 'Ferry Pass')
    expect(feeAt(s, find('Rail Pass'))).toBe(70)
  })
})

describe('running out of credits', () => {
  const broke = (cash: number, owned: string[] = []) => {
    const s = own({ ...setup([0, 0]), turn: 0 }, 1, ...owned)
    return { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, cash } : p)) }
  }
  /** Rolls from the Departure Gate until player 1 lands on the given stop. */
  const landOn = (s: State, target: number) => {
    for (let i = 0; i < 600; i++) {
      const r = applyAction({ ...s, seed: `b${i}` }, { type: 'roll' })
      if (r.players[0].position === target) return r
    }
    throw new Error('no seed found')
  }
  it('sells stops back to the bank at half price before anyone goes out', () => {
    const base = broke(10, [])
    const s = own(base, 0, 'Vancouver') // worth 60: sells for 30
    const r = landOn(s, find('Ticket Fee')) // 10 + 30 from the sale is still short of the 100 fee, so out
    expect(r.players[0].out).toBe(true)
    expect(r.holdings[find('Vancouver')]).toBeNull()
  })
  it('pays in full from the sale and keeps playing when that is enough', () => {
    const s = own(broke(10), 0, 'Rome', 'Lisbon') // 100 + 80 = 180 on sale
    const r = landOn(s, find('Ticket Fee'))
    expect(r.players[0].out).toBe(false)
    expect(r.players[0].cash).toBeGreaterThanOrEqual(0)
    expect(r.message).toMatch(/Sold/)
  })
  it('puts a bankrupt player out, skips their turns and ends the trip when one traveller is left', () => {
    const s = broke(0)
    const r = landOn(s, find('Ticket Fee'))
    expect(r.players[0].out).toBe(true)
    expect(r.phase).toBe('done')
    expect(r.message).toMatch(/last traveller standing/)
    expect(standings(r)[0].index).toBe(1)
  })
  it('skips an eliminated player in a three-player match', () => {
    const three = newGame(3, 'skip')
    const s: State = { ...three, players: three.players.map((p, i) => (i === 1 ? { ...p, out: true } : p)), phase: 'manage' }
    const r = applyAction(s, { type: 'end' })
    expect(activePlayer(r)).toBe(2)
    const r2 = applyAction({ ...r, phase: 'manage' }, { type: 'end' })
    expect(activePlayer(r2)).toBe(0)
  })
  it('does not offer trades to an eliminated player', () => {
    const s = { ...own(setup(), 0, 'Lisbon'), phase: 'manage' as const }
    const out = { ...s, players: s.players.map((p, i) => (i === 1 ? { ...p, out: true } : p)) }
    expect(applyAction(out, { type: 'offer', offer: { buyer: 1, give: [find('Lisbon')], take: [], cash: 10 } })).toBe(out)
  })
})

/** Finds a seed whose first roll for player 1 is (or is not) a double. */
const seedFor = (s: State, want: { double: boolean }) => {
  for (let i = 0; i < 2000; i++) {
    const t = { ...s, seed: `d${i}` }
    const r = applyAction(t, { type: 'roll' })
    if (r.dice && (r.dice[0] === r.dice[1]) === want.double) return t
  }
  throw new Error('no seed')
}

describe('doubles and the Hotel Stopover', () => {
  it('lets a player roll again after doubles, without using up the turn', () => {
    const s = seedFor(setup([0, 0]), { double: true })
    const r = applyAction(s, { type: 'roll' })
    expect(r.again).toBe(true)
    const done = applyAction({ ...r, phase: 'manage' }, { type: 'end' })
    expect(done.phase).toBe('roll')
    expect(activePlayer(done)).toBe(0)
    expect(done.turn).toBe(0)
    expect(done.doubles).toBe(1)
  })
  it('passes the turn after a roll without doubles', () => {
    const s = seedFor(setup([0, 0]), { double: false })
    const r = applyAction(s, { type: 'roll' })
    expect(r.again).toBe(false)
    expect(applyAction({ ...r, phase: 'manage' }, { type: 'end' }).turn).toBe(1)
  })
  it('sends a player to the Hotel Stopover for a third double in a row', () => {
    const s = { ...setup([0, 0]), doubles: 2 }
    let r: State | null = null
    for (let i = 0; i < 400 && !r; i++) {
      const t = applyAction({ ...s, seed: `t${i}` }, { type: 'roll' })
      if (t.message.includes('Third doubles')) r = t
    }
    expect(r).not.toBeNull()
    expect(r!.players[0].position).toBe(HOTEL)
    expect(activePlayer(r!)).toBe(1)
    expect(r!.message).toMatch(/Third doubles/)
  })
  it('sends a player who lands on the Scenic Stopover to the Hotel Stopover', () => {
    let after: State | null = null
    for (let i = 0; i < 800 && !after; i++) {
      const r = applyAction({ ...setup([24, 0]), seed: `sc${i}` }, { type: 'roll' })
      if (r.message.includes('Missed flight')) after = r
    }
    expect(after).not.toBeNull()
    expect(SCENIC).toBe(30)
    expect(after!.players[0].inHotel).toBe(true)
    expect(after!.players[0].position).toBe(HOTEL)
    expect(activePlayer(after!)).toBe(1)
  })
  const stranded = (): State => {
    const s = setup([HOTEL, 0])
    return { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, inHotel: true } : p)) }
  }
  it('lets a stranded player pay to leave, then roll', () => {
    const s = applyAction(stranded(), { type: 'payout' })
    expect(s.players[0].inHotel).toBe(false)
    expect(s.players[0].cash).toBe(START_CASH - HOTEL_FEE)
    expect(s.phase).toBe('roll')
  })
  it('lets a boarding pass leave for free', () => {
    const s0 = stranded()
    const withPass = { ...s0, players: s0.players.map((p, i) => (i === 0 ? { ...p, pass: true } : p)) }
    expect(applyAction(s0, { type: 'usepass' })).toBe(s0)
    const s = applyAction(withPass, { type: 'usepass' })
    expect(s.players[0].inHotel).toBe(false)
    expect(s.players[0].pass).toBe(false)
    expect(s.players[0].cash).toBe(START_CASH)
  })
  it('keeps a stranded player waiting without doubles, frees them on doubles, and charges after three tries', () => {
    let waited: State | null = null
    for (let i = 0; i < 400 && !waited; i++) {
      const t = applyAction({ ...stranded(), seed: `w${i}` }, { type: 'roll' })
      if (t.players[0].inHotel && t.players[0].tries === 1) waited = t
    }
    expect(waited).not.toBeNull()
    expect(activePlayer(waited!)).toBe(1)
    let freed: State | null = null
    for (let i = 0; i < 400 && !freed; i++) {
      const t = applyAction({ ...stranded(), seed: `f${i}` }, { type: 'roll' })
      if (!t.players[0].inHotel) freed = t
    }
    expect(freed!.players[0].position).not.toBe(HOTEL)
    expect(freed!.again).toBe(false)
    const third = { ...stranded(), players: stranded().players.map((p, i) => (i === 0 ? { ...p, tries: 2 } : p)) }
    let paid: State | null = null
    for (let i = 0; i < 400 && !paid; i++) {
      const t = applyAction({ ...third, seed: `p${i}` }, { type: 'roll' })
      if (!t.players[0].inHotel && t.players[0].cash <= START_CASH - HOTEL_FEE + 0) paid = t
    }
    expect(paid).not.toBeNull()
  })
})

describe('mortgages', () => {
  const owned = () => ({ ...own(setup(), 0, 'Rome'), phase: 'manage' as const })
  it('pays half the price and charges nothing until redeemed', () => {
    const s = applyAction(owned(), { type: 'mortgage', space: find('Rome') })
    expect(s.players[0].cash).toBe(START_CASH + mortgageValue(BOARD[find('Rome')]))
    expect(feeAt(s, find('Rome'))).toBe(0)
    expect(canMortgage(s, 0, find('Rome'))).toBe(false)
    const back = applyAction(s, { type: 'redeem', space: find('Rome') })
    expect(back.players[0].cash).toBe(START_CASH + mortgageValue(BOARD[find('Rome')]) - redeemCost(BOARD[find('Rome')]))
    expect(feeAt(back, find('Rome'))).toBeGreaterThan(0)
  })
  it('does not change net worth when mortgaging, and cannot redeem without credits', () => {
    const s = owned()
    const m = applyAction(s, { type: 'mortgage', space: find('Rome') })
    expect(netWorth(m, 0).worth).toBe(netWorth(s, 0).worth)
    const poor = { ...m, players: m.players.map((p, i) => (i === 0 ? { ...p, cash: 1 } : p)) }
    expect(canRedeem(poor, 0, find('Rome'))).toBe(false)
  })
  it('blocks mortgaging a group that has a visitor centre, and building on a mortgaged group', () => {
    let s = { ...own(setup(), 0, 'Vancouver', 'Toronto'), phase: 'manage' as const }
    const m = applyAction(s, { type: 'mortgage', space: find('Toronto') })
    expect(canBuildCentre(m, 0, find('Vancouver'))).toBe(false)
    s = applyAction(s, { type: 'upgrade', space: find('Vancouver') })
    expect(canMortgage(s, 0, find('Toronto'))).toBe(false)
  })
  it('lets a mortgaged stop be visited for free', () => {
    const s = own(setup([0, 0]), 1, 'Mexico City')
    const m = { ...s, holdings: s.holdings.map((h, i) => (i === find('Mexico City') ? { ...h!, mortgaged: true } : h)) }
    let r: State | null = null
    for (let i = 0; i < 600 && !r; i++) {
      const t = applyAction({ ...m, seed: `m${i}` }, { type: 'roll' })
      if (t.players[0].position === find('Mexico City')) r = t
    }
    expect(r!.players[0].cash).toBe(START_CASH)
    expect(r!.message).toMatch(/mortgaged/)
  })
})

describe('trades', () => {
  const two = () => ({ ...own(own(setup(), 0, 'Lisbon', 'Rome'), 1, 'Paris'), phase: 'manage' as const })
  it('swaps stops and credits both ways', () => {
    const s = two()
    const offer = { buyer: 1, give: [find('Lisbon')], take: [find('Paris')], cash: -30 }
    const o = applyAction(s, { type: 'offer', offer })
    expect(o.offer).toEqual(offer)
    const d = applyAction(o, { type: 'accept' })
    expect(d.holdings[find('Lisbon')]?.owner).toBe(1)
    expect(d.holdings[find('Paris')]?.owner).toBe(0)
    expect(d.players[0].cash).toBe(START_CASH - 30)
    expect(d.players[1].cash).toBe(START_CASH + 30)
    expect(d.collected[1]).toContain(find('Lisbon'))
  })
  it('allows several stops at once, and a gift for nothing', () => {
    const s = two()
    const d = applyAction(applyAction(s, { type: 'offer', offer: { buyer: 1, give: [find('Lisbon'), find('Rome')], take: [], cash: 0 } }), { type: 'accept' })
    expect(d.holdings[find('Rome')]?.owner).toBe(1)
  })
  it('rejects invalid trades', () => {
    const s = two()
    const bad = (o: object) => expect(offerProblem(s, 0, { buyer: 1, give: [], take: [], cash: 0, ...o })).not.toBeNull()
    bad({}) // nothing traded
    bad({ give: [find('Paris')] }) // not yours
    bad({ take: [find('Lisbon')] }) // not theirs
    bad({ give: [find('Lisbon'), find('Lisbon')] }) // duplicate
    bad({ buyer: 0, give: [find('Lisbon')] }) // with yourself
    bad({ give: [find('Lisbon')], cash: -START_CASH - 1 }) // you cannot pay that
    bad({ give: [find('Lisbon')], cash: 1.5 })
    const centre = { ...s, holdings: s.holdings.map((h, i) => (i === find('Lisbon') ? { ...h!, centre: true } : h)) }
    expect(offerProblem(centre, 0, { buyer: 1, give: [find('Lisbon')], take: [], cash: 0 })).not.toBeNull() // visitor centres stay put
  })
})

describe('fortune cards', () => {
  it('have their own deck of ten, with the Hotel Stopover and a boarding pass', () => {
    expect(FORTUNE).toHaveLength(10)
    expect(FORTUNE.some((c) => 'hotel' in c)).toBe(true)
    expect(FORTUNE.some((c) => 'pass' in c)).toBe(true)
  })
  it('are drawn from fortune spaces', () => {
    const fortune = BOARD.findIndex((sp) => sp.kind === 'card' && sp.deck === 'fortune')
    const travel = BOARD.findIndex((sp) => sp.kind === 'card' && sp.deck === 'travel')
    const titles = (target: number, from: number) => {
      const seen = new Set<string>()
      for (let i = 0; i < 800; i++) {
        const r = applyAction({ ...setup([from, 0]), seed: `c${i}` }, { type: 'roll' })
        if (r.players[0].position === target || r.message.includes(`Landed on ${BOARD[target].name}`)) seen.add(r.message)
      }
      return [...seen].join('|')
    }
    expect(titles(fortune, Math.max(0, fortune - 7))).toMatch(/Fortune|bestseller|medical|pass|Hotel|sponsor|luggage|festival|photo book|shout|maintenance|cancelled|boarding/i)
    expect(titles(travel, Math.max(0, travel - 7))).not.toMatch(/bestseller|Priority boarding/)
  })
})
