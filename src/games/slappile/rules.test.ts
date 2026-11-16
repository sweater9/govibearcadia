import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { PLAY_CAP, advance, cardCount, chancesOf, newGame, play, scoreFor, slap, slapPattern, slappable, type RState } from './rules'

// card id = suit*13 + rank-1, so rank r in suit 0 is r-1
const c = (rank: number, suit = 0) => suit * 13 + rank - 1
const rng = () => createRandom('t')
const withState = (s: RState, p: Partial<RState>): RState => ({ ...s, ...p })

describe('slap patterns', () => {
  it('finds pairs and sandwiches, not plain piles', () => {
    expect(slapPattern([c(5), c(5, 1)])).toBe('pair')
    expect(slapPattern([c(5), c(9), c(5, 1)])).toBe('sandwich')
    expect(slapPattern([c(5), c(6), c(7)])).toBeNull()
    expect(slappable([c(5)])).toBe(false)
  })
  it('optional rules are off by default', () => {
    expect(slapPattern([c(4), c(9), c(2), c(4, 1)])).toBeNull()
    expect(slapPattern([c(4), c(6)], { pair: true, sandwich: true, topBottom: false, addTen: true })).toBe('adds to ten')
  })
  it('face cards give 1 to 4 chances', () => {
    expect([11, 12, 13, 1, 7].map((r) => chancesOf(c(r)))).toEqual([1, 2, 3, 4, 0])
  })
})

describe('dealing', () => {
  it('deals all 52 cards, and the same seed deals the same game', () => {
    const a = newGame(3, 'normal', 'x')
    expect(cardCount(a)).toBe(52)
    expect(a.hands.map((h) => h.length)).toEqual([13, 13, 13, 13])
    expect(newGame(3, 'normal', 'x').hands).toEqual(a.hands)
    expect(newGame(3, 'normal', 'y').hands).not.toEqual(a.hands)
  })
})

describe('play', () => {
  it('only the player to move can play', () => {
    const s = newGame(1, 'normal', 'a')
    expect(play(s, 1, rng())).toBe(s)
    const n = play(s, 0, rng())
    expect(n.turn).toBe(1)
    expect(n.pile).toHaveLength(1)
    expect(cardCount(n)).toBe(52)
  })
  it('a failed face challenge gives the pile to the challenger', () => {
    let s = newGame(1, 'normal', 'a')
    s = withState(s, { hands: [[c(11), c(2)], [c(3), c(4, 1), c(6)]], pile: [], turn: 0 })
    s = play(s, 0, rng()) // jack: one chance for player 1
    expect(s.challenge).toEqual({ by: 0, remaining: 1 })
    s = play(s, 1, rng()) // a 3: fails
    expect(s.pile).toHaveLength(0)
    expect(s.hands[0]).toHaveLength(3)
    expect(s.turn).toBe(0)
    expect(s.challenge).toBeNull()
  })
  it('answering with a face card passes the challenge on', () => {
    let s = newGame(1, 'normal', 'a')
    s = withState(s, { hands: [[c(12), c(2)], [c(13, 1), c(4)]], pile: [], turn: 0 })
    s = play(s, 0, rng())
    s = play(s, 1, rng())
    expect(s.challenge).toEqual({ by: 1, remaining: 3 })
    expect(s.turn).toBe(0)
  })
})

describe('slap', () => {
  it('a good slap takes the pile', () => {
    let s = newGame(1, 'normal', 'a')
    s = withState(s, { hands: [[c(2), c(3)], [c(9)]], pile: [c(5), c(5, 1)] })
    const n = slap(s, 0, rng())
    expect(n.hands[0]).toHaveLength(4)
    expect(n.pile).toHaveLength(0)
    expect(n.goodSlaps).toBe(1)
    expect(n.lastSlap).toMatchObject({ who: 0, ok: true })
  })
  it('a bad slap burns a card under the pile', () => {
    let s = newGame(1, 'normal', 'a')
    s = withState(s, { hands: [[c(2), c(3)], [c(9)]], pile: [c(5), c(6)] })
    const n = slap(s, 0, rng())
    expect(n.hands[0]).toEqual([c(3)])
    expect(n.pile[0]).toBe(c(2))
    expect(n.badSlaps).toBe(1)
    expect(cardCount(n)).toBe(cardCount(s))
  })
})

describe('ending', () => {
  it('whoever holds every card wins', () => {
    let s = newGame(1, 'normal', 'a')
    s = withState(s, { hands: [[c(2)], [c(9)]], pile: [c(5), c(5, 1)] })
    const n = slap(s, 0, rng())
    expect(n.over).toBe(false)
    const m = withState(s, { hands: [[c(2)], []], pile: [c(5), c(5, 1)] })
    const w = slap(m, 0, rng())
    expect(w.over).toBe(true)
    expect(w.winner).toBe(0)
    expect(scoreFor(w)).toBeGreaterThan(500)
  })
  it('a player who runs out is skipped', () => {
    let s = newGame(2, 'normal', 'a')
    s = withState(s, { hands: [[c(2), c(3)], [], [c(4), c(6)]], pile: [], turn: 0 })
    s = play(s, 0, rng())
    expect(s.turn).toBe(2)
  })
  it('the play cap calls the game for whoever has most cards', () => {
    let s = newGame(1, 'normal', 'a')
    s = withState(s, { hands: [[c(2), c(3), c(4)], [c(9)]], pile: [], turn: 0, plays: PLAY_CAP - 1 })
    s = play(s, 0, rng())
    expect(s.over).toBe(true)
    expect(s.capped).toBe(true)
    expect(s.winner).toBe(0)
  })
})

describe('computer opponents', () => {
  it('play on their own and a game is repeatable for a seed', () => {
    const run = () => {
      const r = createRandom('ai')
      let s = newGame(1, 'hard', 'rep')
      for (let i = 0; i < 400 && !s.over; i++) {
        s = advance(s, 50, r)
        if (s.turn === 0 && !s.over) s = play(s, 0, r)
      }
      return s
    }
    const a = run()
    expect(a.plays).toBeGreaterThan(5)
    expect(cardCount(a)).toBe(52)
    expect(run().hands).toEqual(a.hands)
  })
  it('hard slaps a real pattern before the player does nothing', () => {
    let s = newGame(1, 'hard', 'a')
    s = withState(s, { hands: [[c(2), c(3)], [c(9), c(10)]], pile: [c(5)], turn: 0 })
    const r = createRandom('slap')
    s = play(withState(s, { hands: [[c(5, 1), c(3)], [c(9), c(10)]] }), 0, r)
    let done = s
    for (let i = 0; i < 100; i++) done = advance(done, 50, r)
    expect(done.goodSlaps + done.hands[1].length).toBeGreaterThan(0)
    expect(cardCount(done)).toBe(cardCount(s))
  })
})
