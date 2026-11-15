import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { GOAL, aiDiscard, aiPeg, cardName, discard, isOver, isState, legalCards, newGame, next, pegPoints, play, scoreFor, scoreHand, type CState, type Who } from './rules'

/** Card id from a rank (1 to 13) and suit (0 to 3). */
const c = (rank: number, suit = 0) => suit * 13 + rank - 1

describe('scoring a hand', () => {
  it('scores the perfect 29', () => {
    expect(scoreHand([c(5, 0), c(5, 1), c(5, 2), c(11, 3)], c(5, 3)).points).toBe(29)
  })
  it('counts fifteens, pairs and runs with multiples', () => {
    const r = scoreHand([c(7, 0), c(7, 1), c(8, 0), c(8, 1)], c(9, 2))
    expect(r.points).toBe(24)
    expect(r.items.map((i) => i.label)).toEqual(['4 fifteens', '2 pairs', '4 runs of 3'])
  })
  it('scores nothing for a dead hand', () => {
    expect(scoreHand([c(1, 0), c(3, 1), c(6, 2), c(13, 3)], c(12, 0)).points).toBe(0)
  })
  it('scores flushes: four in hand, five with the cut, never four in the crib', () => {
    const hearts = [c(2, 1), c(4, 1), c(7, 1), c(13, 1)]
    expect(scoreHand(hearts, c(9, 0)).items.some((i) => i.label === 'flush of 4')).toBe(true)
    expect(scoreHand(hearts, c(9, 1)).items.some((i) => i.label === 'flush of 5')).toBe(true)
    expect(scoreHand(hearts, c(9, 0), true).items.some((i) => i.label.startsWith('flush'))).toBe(false)
    expect(scoreHand(hearts, c(9, 1), true).items.some((i) => i.label === 'flush of 5')).toBe(true)
  })
  it('scores nobs only for a jack matching the cut suit', () => {
    expect(scoreHand([c(11, 2), c(2, 0), c(4, 1), c(13, 3)], c(9, 2)).items.map((i) => i.label)).toContain('nobs')
    expect(scoreHand([c(11, 2), c(2, 0), c(4, 1), c(13, 3)], c(9, 1)).items.map((i) => i.label)).not.toContain('nobs')
  })
})

describe('pegging points', () => {
  it('scores fifteen, thirty-one, pairs and runs in any order', () => {
    expect(pegPoints([c(5), c(13)]).points).toBe(2)
    expect(pegPoints([c(10), c(10, 1), c(10, 2)]).points).toBe(6)
    expect(pegPoints([c(4), c(6), c(5, 1)]).points).toBe(5)
    expect(pegPoints([c(3), c(5), c(4, 1), c(6, 1)]).points).toBe(4)
    expect(pegPoints([c(9), c(9, 1), c(9, 2), c(9, 3)]).points).toBe(12)
    expect(pegPoints([c(10), c(10, 1), c(10, 2), c(1)]).points).toBe(2)
    expect(pegPoints([c(4), c(4, 1), c(7), c(8, 1), c(9)]).points).toBe(3 + 0)
  })
  it('a run must be unbroken: a duplicate rank spoils it', () => {
    expect(pegPoints([c(5), c(4), c(5, 1), c(7)]).points).toBe(0)
  })
})

function round(seed = 'rules'): CState {
  return newGame(seed)
}

describe('a deal', () => {
  it('deals six cards each, deterministically, and alternates the dealer', () => {
    const s = round()
    expect(s.hands[0]).toHaveLength(6)
    expect(s.hands[1]).toHaveLength(6)
    expect(new Set([...s.hands[0], ...s.hands[1], s.starter]).size).toBe(13)
    expect(round()).toEqual(s)
    expect(isState(s)).toBe(true)
  })
  it('needs exactly two of your own cards, and cannot discard twice', () => {
    const s = round()
    expect(discard(s, 0, [s.hands[0][0]])).toBe(s)
    expect(discard(s, 0, [s.hands[0][0], s.hands[0][0]])).toBe(s)
    expect(discard(s, 0, [s.hands[1][0], s.hands[0][0]])).toBe(s)
    const one = discard(s, 0, [s.hands[0][0], s.hands[0][1]])
    expect(one.crib).toHaveLength(2)
    expect(one.phase).toBe('discard')
    expect(discard(one, 0, [one.hands[0][0], one.hands[0][1]])).toBe(one)
  })
  it('after both discards the crib has four cards and pegging begins with the non-dealer', () => {
    let s = round()
    s = discard(s, 0, aiDiscard(s, 0, 'normal', createRandom('a')))
    s = discard(s, 1, aiDiscard(s, 1, 'normal', createRandom('b')))
    expect(s.crib).toHaveLength(4)
    expect(s.hands[0]).toHaveLength(4)
    if (s.phase === 'peg') expect(s.turn).toBe(s.dealer === 0 ? 1 : 0)
  })
})

describe('pegging flow', () => {
  const peg = (hands: [number[], number[]], o: Partial<CState> = {}): CState => ({ ...round(), phase: 'peg', hands, kept: [hands[0], hands[1]], crib: [c(2), c(3), c(4), c(6)], starter: c(13, 3), dealer: 1, turn: 0, scores: [0, 0], ...o })
  it('only a card that keeps the count at 31 or less is legal, and you must be on turn', () => {
    const s = peg([[c(10), c(2)], [c(9), c(1)]], { pile: [c(10), c(10, 1), c(10, 2)], count: 30, turn: 0 })
    expect(legalCards(s, 0)).toEqual([c(1)].filter((x) => s.hands[0].includes(x)))
    expect(legalCards(s, 1)).toEqual([])
    expect(play(s, 0, c(10))).toBe(s)
    expect(play(s, 1, c(9))).toBe(s)
  })
  it('scores a pair and passes the turn', () => {
    const s = peg([[c(7), c(2)], [c(7, 1), c(9)]], { pile: [c(7, 2)], count: 7, lastPlayer: 1, turn: 0 })
    const r = play(s, 0, c(7))
    expect(r.scores[0]).toBe(2)
    expect(r.turn).toBe(1)
  })
  it('thirty-one pays two and starts a new count', () => {
    const s = peg([[c(10), c(2)], [c(9), c(3)]], { pile: [c(10, 1), c(10, 2), c(1)], count: 21, lastPlayer: 1, turn: 0 })
    const r = play(s, 0, c(10))
    expect(r.scores[0]).toBe(2)
    expect(r.count).toBe(0)
    expect(r.pile).toEqual([])
  })
  it('go: the other player carries on, and last card pays one when nobody can play', () => {
    const s = peg([[c(9)], [c(9, 1)]], { pile: [c(10, 1), c(10, 2)], count: 20, lastPlayer: 1, turn: 0 })
    const r = play(s, 0, c(9))
    // 20 + 9 = 29, then the computer's 9 cannot be played: nobody can, so you score last card and a new count starts with the computer.
    expect(r.scores[0]).toBe(1)
    expect(r.count).toBe(0)
    expect(r.turn).toBe(1)
    expect(legalCards(r, 1)).toEqual([c(9, 1)])
  })
  it('a player who cannot play says go and the other keeps playing', () => {
    const s = peg([[c(10)], [c(2), c(3)]], { pile: [c(10, 1), c(10, 2)], count: 20, lastPlayer: 1, turn: 1, hands: [[c(10)], [c(2), c(3)]] })
    const r = play(s, 1, c(2))
    expect(r.count).toBe(22)
    expect(r.turn).toBe(1)
    expect(r.note).toMatch(/go/)
  })
})

describe('reaching 121', () => {
  it('wins on the spot while pegging and stops further scoring', () => {
    const s: CState = { ...round(), phase: 'peg', hands: [[c(5), c(2)], [c(9), c(3)]], kept: [[], []], dealer: 1, turn: 0, scores: [120, 100], pile: [c(10)], count: 10, lastPlayer: 1 }
    const r = play(s, 0, c(5))
    expect(r.phase).toBe('over')
    expect(r.winner).toBe(0)
    expect(r.scores[0]).toBe(GOAL)
    expect(isOver(r)).toBe(true)
    expect(play(r, 1, c(9))).toBe(r)
    expect(next(r)).toBe(r)
  })
})

describe('a whole game', () => {
  function playOut(seed: string, level: 'easy' | 'normal' | 'hard') {
    const rnd = createRandom(`${seed}-ai`)
    let s = newGame(seed)
    let guard = 0
    while (!isOver(s) && guard++ < 4000) {
      const before = s
      if (s.phase === 'discard') {
        for (const w of [0, 1] as Who[]) if (s.hands[w].length === 6) s = discard(s, w, aiDiscard(s, w, level, rnd))
      } else if (s.phase === 'peg') s = play(s, s.turn, aiPeg(s, s.turn, level, rnd))
      else s = next(s)
      expect(s).not.toBe(before)
      expect(s.scores[0]).toBeLessThanOrEqual(GOAL)
      expect(s.scores[1]).toBeLessThanOrEqual(GOAL)
    }
    return s
  }
  it('always ends, with one winner at 121, and is deterministic for a seed', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const a = playOut(`g-${level}`, level)
      expect(a.phase).toBe('over')
      expect(a.winner).not.toBeNull()
      expect(a.scores[a.winner!]).toBe(GOAL)
      expect(playOut(`g-${level}`, level)).toEqual(a)
    }
  })
  it('scores a win above a loss, and a skunk above a plain win', () => {
    const base = { ...newGame('x'), phase: 'over' as const }
    const plain = scoreFor({ ...base, winner: 0, scores: [121, 100] })
    const skunk = scoreFor({ ...base, winner: 0, scores: [121, 80] })
    expect(skunk).toBeGreaterThan(plain)
    expect(scoreFor({ ...base, winner: 1, scores: [90, 121] })).toBe(90)
    expect(plain).toBeGreaterThan(121)
  })
  it('names cards readably', () => {
    expect(cardName(c(11, 1))).toBe('J♥')
    expect(cardName(c(1, 0))).toBe('A♠')
  })
})
