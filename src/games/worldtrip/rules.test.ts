import { describe, expect, it } from 'vitest'
import { BOARD, BOARD_SIZE, CELLS, CENTRE_COST, GROUPS, GRID } from './board'
import { ALLOWANCE, applyAction, canBuildCentre, newGame, netWorth, standings, START_CASH, type Action, type State } from './rules'
import { loadMatch, saveMatch } from './save'

const find = (name: string) => BOARD.findIndex((s) => s.name === name)

describe('the board', () => {
  it('has exactly 40 spaces with the right mix', () => {
    expect(BOARD).toHaveLength(BOARD_SIZE)
    const count = (k: string) => BOARD.filter((s) => s.kind === k).length
    expect([count('city'), count('airport'), count('service'), count('card'), count('fee'), count('corner')]).toEqual([22, 4, 2, 6, 2, 4])
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
    const offered = applyAction(s, { type: 'offer', offer: { space: find('Lisbon'), buyer: 1, price: 200 } })
    expect(offered.offer).not.toBeNull()
    const done = applyAction(offered, { type: 'accept' })
    expect(done.holdings[find('Lisbon')]?.owner).toBe(1)
    expect(done.players[1].cash).toBe(START_CASH - 200)
    expect(done.players[0].cash).toBe(START_CASH + 200)
    expect(applyAction(done, { type: 'offer', offer: { space: find('Lisbon'), buyer: 0, price: 1 } })).toBe(done)
  })
  it('rejects offers the buyer cannot afford, or for stops the seller does not own', () => {
    const s = { ...own(setup(), 0, 'Lisbon'), phase: 'manage' as const }
    expect(applyAction(s, { type: 'offer', offer: { space: find('Lisbon'), buyer: 1, price: START_CASH + 1 } })).toBe(s)
    expect(applyAction(s, { type: 'offer', offer: { space: find('Rome'), buyer: 1, price: 10 } })).toBe(s)
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
      else act({ type: 'end' })
    }
    return { s, actions }
  }
  it('ends after the chosen number of turns each and ranks the players', () => {
    for (const t of [12, 20, 30]) {
      const { s } = play(t)
      expect(s.phase).toBe('done')
      expect(s.turn).toBe(t * 3)
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
