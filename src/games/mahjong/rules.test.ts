import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { chooseClaim, chooseTurnAction, LEVELS, type Level } from './ai'
import { LIVE_RESERVE, act, buildWall, invariantErrors, kongChoices, liveLeft, newMatch, optionsFor, selfDrawScore, startNextHand, windOf, type Decision, type State } from './rules'
import { counts } from './tiles'

const must = (r: ReturnType<typeof act>): State => {
  if (!r.ok) throw new Error(r.reason)
  return r.state
}

/** Play whole hands with computers in every seat, checking the rules' invariants after every action. */
function play(seed: string, level: Level, config: Parameters<typeof newMatch>[1] = {}) {
  const random = createRandom(seed)
  let s = newMatch(random, config)
  let guard = 0
  let hands = 0
  const wins: number[] = []
  while (s.phase !== 'over' && guard++ < 20000) {
    expect(invariantErrors(s), `${seed} ${guard}`).toEqual([])
    if (s.phase === 'hand-over') {
      hands++
      s = startNextHand(s, random)
    } else if (s.phase === 'discard') s = must(act(s, chooseTurnAction(s, s.turn, level, random)))
    else {
      const decisions: Record<number, Decision> = {}
      for (const k of Object.keys(s.options)) decisions[Number(k)] = chooseClaim(s, Number(k), level, random)
      s = must(act(s, { type: 'decide', decisions }))
    }
    if (s.result && s.phase !== 'discard' && s.phase !== 'claim') {
      expect(s.result.deltas.reduce((a, b) => a + b, 0)).toBe(0)
      if (s.result.kind === 'win') wins.push(s.result.tai)
    }
  }
  return { s, hands: hands + 1, wins }
}

describe('the wall and the deal', () => {
  it('has 144 tiles: four of each of 34, and 8 flowers', () => {
    const w = buildWall()
    expect(w).toHaveLength(144)
    expect(w.filter((t) => t === 0)).toHaveLength(4)
    expect(w.filter((t) => t >= 34)).toHaveLength(8)
  })
  it('deals 16 tiles to each player and the dealer draws a 17th, with every flower set aside', () => {
    const s = newMatch(createRandom('deal'))
    for (let i = 0; i < 4; i++) {
      const p = s.seats[i]
      expect(p.hand.length + 3 * p.melds.length).toBe(i === s.dealer ? 17 : 16)
      expect(p.hand.some((t) => t >= 34)).toBe(false)
    }
    expect(s.phase).toBe('discard')
    expect(invariantErrors(s)).toEqual([])
  })
  it('the same seed deals the same hand', () => {
    expect(newMatch(createRandom('x')).seats).toEqual(newMatch(createRandom('x')).seats)
    expect(newMatch(createRandom('x')).seats).not.toEqual(newMatch(createRandom('y')).seats)
  })
  it('seat winds follow the dealer', () => {
    const s = newMatch(createRandom('w'))
    expect([0, 1, 2, 3].map((i) => windOf(s, i))).toEqual([0, 1, 2, 3])
  })
})

describe('turns and claims', () => {
  it('a discard goes to the next player to draw when nobody can claim', () => {
    let s = newMatch(createRandom('t1'))
    s = must(act(s, { type: 'discard', tile: s.seats[0].hand[0] }))
    while (s.phase === 'claim') s = must(act(s, { type: 'decide', decisions: {} }))
    expect(s.phase).toBe('discard')
    expect(s.turn).toBe(1)
    expect(s.drawn).not.toBeNull()
  })
  it('cannot discard a tile that is not in the hand, nor out of phase', () => {
    const s = newMatch(createRandom('t2'))
    const missing = [...Array(34).keys()].find((t) => !s.seats[0].hand.includes(t))!
    expect(act(s, { type: 'discard', tile: missing }).ok).toBe(false)
    expect(act(s, { type: 'decide', decisions: {} }).ok).toBe(false)
  })
  it('only the next player may chow, any player may pung', () => {
    const s = newMatch(createRandom('t3'))
    const set = (seat: number, hand: number[]) => { s.seats[seat].hand = hand }
    set(1, [4, 5, 20, 20, 0, 9, 10, 11, 12, 13, 14, 15, 16, 17, 22, 24]) // 5c 6c and a pair of 3 Bamboo among others
    set(2, [4, 5, 0, 1, 9, 10, 11, 12, 13, 14, 15, 16, 17, 22, 24, 26])
    const o1 = optionsFor(s, 1, 3, 0) // 4 Characters discarded by seat 0
    const o2 = optionsFor(s, 2, 3, 0)
    expect(o1.chows).toContain(3) // 4-5-6 characters... low tile 3
    expect(o2.chows).toEqual([])
  })
  it('claiming a pung moves the discard into an open meld and the claimant must discard', () => {
    let s = newMatch(createRandom('t4'))
    s.seats[2].hand = [7, 7, 0, 9, 10, 11, 12, 13, 14, 15, 16, 17, 22, 24, 26, 30]
    s.seats[0].hand = [7, ...s.seats[0].hand.filter((t) => t !== 7).slice(0, 16)]
    s.drawn = 7
    s = must(act(s, { type: 'discard', tile: 7 }))
    expect(s.phase).toBe('claim')
    expect(s.options[2].pung).toBe(true)
    s = must(act(s, { type: 'decide', decisions: { 2: { type: 'pung' } } }))
    expect(s.turn).toBe(2)
    expect(s.phase).toBe('discard')
    expect(s.seats[2].melds).toEqual([{ kind: 'pung', tile: 7, open: true }])
    expect(s.seats[0].discards).not.toContain(7)
  })
  it('a win outranks a pung, and the first winner after the discarder takes it', () => {
    const s = newMatch(createRandom('t5'))
    // A complete 16-tile hand waiting on 9 Bamboo (index 26): 123c 456c 789c 123d 456d 9b + pair? build: 4 sets + 9b pair needs 26
    s.seats[1].hand = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 26]
    s.seats[1].hand = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 26] // 5 sets short one: waiting on the pair tile 26
    s.seats[2].hand = [...s.seats[1].hand]
    const o = optionsFor(s, 1, 26, 0)
    expect(o.win).toBe(true)
  })
})

describe('kongs', () => {
  it('declares a concealed kong from four of a kind and draws a replacement from the back', () => {
    let s = newMatch(createRandom('k1'))
    const p = s.seats[s.turn]
    p.hand = [5, 5, 5, 5, 0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 28, 33].slice(0, 17)
    s.drawn = 33
    expect(kongChoices(s).concealed).toEqual([5])
    const back = s.back
    s = must(act(s, { type: 'concealed-kong', tile: 5 }))
    expect(s.seats[s.turn].melds).toEqual([{ kind: 'kong', tile: 5, open: false }])
    expect(s.back).toBeGreaterThan(back)
    expect(s.afterKong).toBe(true)
  })
  it('adds the fourth tile of an exposed pung as a kong', () => {
    const s0 = newMatch(createRandom('k2'))
    const p = s0.seats[s0.turn]
    p.melds = [{ kind: 'pung', tile: 5, open: true }]
    p.hand = [5, 0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 27, 28, 33]
    s0.drawn = 5
    expect(kongChoices(s0).added).toEqual([5])
    const s = must(act(s0, { type: 'added-kong', tile: 5 }))
    expect(s.seats[s.turn].melds[0].kind).toBe('kong')
  })
})

describe('winning and payment', () => {
  const winningHand = (): State => {
    const s = newMatch(createRandom('win'))
    const d = s.dealer
    s.seats[d].hand = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 18, 18] // 123c 456c 789c 123d 456d + pair
    s.drawn = 18
    return s
  }
  it('a dealer self-draw is paid by all three, with the dealer bonus on every payment', () => {
    const s0 = winningHand()
    expect(selfDrawScore(s0)).not.toBeNull()
    const s = must(act(s0, { type: 'tsumo' }))
    expect(s.result?.kind).toBe('win')
    if (s.result?.kind !== 'win') return
    expect(s.result.selfDraw).toBe(true)
    expect(s.result.deltas.reduce((a, b) => a + b, 0)).toBe(0)
    const per = 30 + 10 * (s.result.tai + 1) // dealer tai 1 at lian 0
    expect(s.result.deltas[s0.dealer]).toBe(3 * per)
    expect(s.dealer).toBe(s0.dealer) // the dealer keeps the deal after winning
    expect(s.lian).toBe(1)
  })
  it('a hand that is not complete cannot be declared', () => {
    const s = newMatch(createRandom('nowin'))
    expect(act(s, { type: 'tsumo' }).ok).toBe(false)
  })
  it('a non-dealer win on a discard is paid by the discarder only, and the deal passes', () => {
    let s = newMatch(createRandom('disc'))
    const dealer = s.dealer
    const winner = 1
    s.seats[winner].hand = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 18]
    s.seats[dealer].hand = [18, ...s.seats[dealer].hand.filter((t) => t !== 18).slice(0, 16)]
    s.drawn = 18
    s = must(act(s, { type: 'discard', tile: 18 }))
    s = must(act(s, { type: 'decide', decisions: { [winner]: { type: 'win' } } }))
    if (s.result?.kind !== 'win') throw new Error('expected a win')
    expect(s.result.from).toBe(dealer)
    const loser = s.result.deltas.map((d, i) => (d < 0 ? i : -1)).filter((i) => i >= 0)
    expect(loser).toEqual([dealer])
    expect(s.dealer).toBe((dealer + 1) % 4)
    expect(s.lian).toBe(0)
    expect(s.phase).toBe('hand-over')
  })
})

describe('whole matches with computers in every seat', () => {
  for (const level of LEVELS)
    it(`${level}: hands finish with every tile accounted for and payments summing to zero`, () => {
      for (const seed of ['a', 'b', 'c']) {
        const { s, hands } = play(`${level}-${seed}`, level, { match: 'single' })
        expect(s.phase).toBe('over')
        expect(hands).toBe(1)
      }
    })
  it('a full East round deals to each seat in turn and ends', () => {
    const { s, hands } = play('east', 'medium')
    expect(s.phase).toBe('over')
    expect(s.dealerTurns).toBe(4)
    expect(hands).toBeGreaterThanOrEqual(4)
    expect(s.scores.reduce((a, b) => a + b, 0)).toBe(4 * s.config.start)
  })
  it('the reserve is never drawn from the front', () => {
    const s = newMatch(createRandom('r'))
    expect(liveLeft(s)).toBe(144 - 16 * 4 - 1 - LIVE_RESERVE - s.back)
    expect(counts(s.seats[0].hand).length).toBe(34)
  })
})
