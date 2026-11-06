import { describe, expect, it } from 'vitest'
import { applyAction, BOARD, newGame, ROUNDS, standings } from './rules'

describe('Bazaar', () => {
  it('buys and upgrades a property, then transfers the shop and payment only upon acceptance', () => {
    const initial = newGame(2, 'bazaar')
    initial.players[0].position = 1
    initial.phase = 'buy'
    const bought = applyAction(initial, { type: 'buy' })
    expect(bought.players[0].cash).toBe(330)
    expect(initial.holdings[1]).toBeNull()
    const upgraded = applyAction(bought, { type: 'upgrade', property: 1 })
    expect(upgraded.players[0].cash).toBe(250)
    expect(standings(upgraded)[0].worth).toBe(400)
    const pending = applyAction(upgraded, { type: 'offer', offer: { property: 1, buyer: 1, price: 175 } })
    expect(applyAction(pending, { type: 'end' })).toBe(pending)
    expect(pending.holdings[1]).toEqual({ owner: 0, shop: true })
    expect(applyAction(pending, { type: 'decline' }).holdings).toBe(pending.holdings)
    const traded = applyAction(pending, { type: 'accept' })
    expect(traded.holdings[1]).toEqual({ owner: 1, shop: true })
    expect(traded.players.map(({ cash }) => cash)).toEqual([425, 225])
    expect(applyAction(traded, { type: 'accept' })).toBe(traded)
  })

  it('charges only available cash for rent and refuses offers the buyer cannot afford', () => {
    const initial = newGame(2, 'bazaar')
    const { dice } = applyAction(initial, { type: 'roll' })
    initial.players[0] = { position: BOARD.length + 1 - dice![0] - dice![1], cash: 5 }
    initial.holdings[1] = { owner: 1, shop: true }
    // Put Flower Lane one roll ahead, crossing Market Gate. Reduce the cash
    // independently by testing a later property on the same roll without a crossing.
    const gate = applyAction(initial, { type: 'roll' })
    expect(gate.players.map(({ cash }) => cash)).toEqual([27, 428])
    const landing = dice![0] + dice![1]
    const destination = BOARD.findIndex((space, i) => i >= landing && space.kind === 'property')
    initial.players[0].position = destination - landing
    initial.holdings[destination] = { owner: 1, shop: true }
    const next = applyAction(initial, { type: 'roll' })
    expect(next.players.map(({ cash }) => cash)).toEqual([0, 405])
    const unaffordable = { ...next, turn: 1 }
    expect(applyAction(unaffordable, { type: 'offer', offer: { property: destination, buyer: 0, price: 1 } })).toBe(unaffordable)
  })

  it.each([2, 3, 4])('plays exactly 12 rounds with %i players', (count) => {
    let state = newGame(count, 'bazaar')
    for (let turn = 0; turn < count * ROUNDS; turn++) {
      expect(state.phase).toBe('roll')
      state = applyAction(state, { type: 'roll' })
      if (state.phase === 'buy') state = applyAction(state, { type: 'skip' })
      state = applyAction(state, { type: 'end' })
    }
    expect(state.phase).toBe('done')
    expect(applyAction(state, { type: 'roll' })).toBe(state)
  })
})
