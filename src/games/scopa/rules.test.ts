import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { GOAL, SETTEBELLO, aiMove, captureOptions, cardName, isOver, isState, legalMoves, newGame, next, play, primieraValue, rankOf, scoreFor, scoreHand, suitOf, type SState } from './rules'

/** Card id from a rank (1 to 10) and suit (0 coins, 1 cups, 2 swords, 3 clubs). */
const c = (rank: number, suit = 0) => suit * 10 + rank - 1

const base = (o: Partial<SState>): SState => ({ ...newGame('t'), phase: 'play', draw: [], table: [], hands: [[], []], captured: [[], []], scope: [0, 0], lastCapturer: null, turn: 0, scores: [0, 0], ...o })

describe('cards', () => {
  it('has forty distinct cards with sensible names and values', () => {
    expect(new Set(Array.from({ length: 40 }, (_, i) => `${suitOf(i)}:${rankOf(i)}`)).size).toBe(40)
    expect(cardName(SETTEBELLO)).toBe('7 of Coins')
    expect(cardName(c(10, 3))).toBe('Re of Clubs')
    expect(primieraValue(c(7))).toBe(21)
    expect(primieraValue(c(6))).toBe(18)
    expect(primieraValue(c(1))).toBe(16)
    expect(primieraValue(c(9))).toBe(10)
  })
})

describe('capture options', () => {
  it('a card of the same value must be taken instead of any sum', () => {
    expect(captureOptions([c(3), c(4, 1), c(7, 2)], c(7, 1))).toEqual([[c(7, 2)]])
    // 3 + 4 also makes 7, but the single seven has to be taken.
  })
  it('two equal cards on the table give a choice of which one', () => {
    expect(captureOptions([c(5), c(5, 1), c(2)], c(5, 2))).toEqual([[c(5)], [c(5, 1)]])
  })
  it('otherwise any set that adds up, including several sets', () => {
    const opts = captureOptions([c(1), c(2, 1), c(3), c(4, 2)], c(5, 3))
    const key = (x: number[][]) => x.map((o) => [...o].sort().join()).sort()
    expect(key(opts)).toEqual(key([[c(1), c(4, 2)], [c(2, 1), c(3)]]))
  })
  it('three cards can make the sum', () => {
    expect(captureOptions([c(1), c(2, 1), c(3, 2)], c(6, 3))).toEqual([[c(1), c(2, 1), c(3, 2)]])
  })
  it('no match means the card is dropped', () => {
    expect(captureOptions([c(9), c(8, 1)], c(2, 2))).toEqual([])
    expect(captureOptions([], c(2))).toEqual([])
  })
})

describe('playing a card', () => {
  it('rejects a wrong turn, a card you do not hold, and an illegal take', () => {
    const s = base({ table: [c(3), c(4, 1)], hands: [[c(7, 2)], [c(1)]] })
    expect(play(s, 1, c(1))).toBe(s)
    expect(play(s, 0, c(2))).toBe(s)
    expect(play(s, 0, c(7, 2), [c(3)])).toBe(s)
    expect(play(s, 0, c(7, 2), [])).toBe(s)
    expect(play(s, 0, c(7, 2), [c(3), c(4, 1)]).captured[0]).toHaveLength(3)
  })
  it('dropping is only allowed when nothing can be captured', () => {
    const s = base({ table: [c(5)], hands: [[c(5, 1), c(9, 2)], [c(1)]] })
    expect(play(s, 0, c(5, 1), [])).toBe(s)
    const d = play(s, 0, c(9, 2))
    expect(d.table).toContain(c(9, 2))
    expect(d.turn).toBe(1)
  })
  it('a sweep scores a scopa, but not on the last play of the hand', () => {
    const s = base({ table: [c(3)], hands: [[c(3, 1), c(8, 2)], [c(1), c(2)]], draw: [c(10), c(10, 1), c(10, 2), c(9), c(9, 1), c(9, 2)] })
    const r = play(s, 0, c(3, 1), [c(3)])
    expect(r.scope[0]).toBe(1)
    expect(r.note).toMatch(/scopa/)
    const last = base({ table: [c(3)], hands: [[c(3, 1)], []] })
    const l = play(last, 0, c(3, 1), [c(3)])
    expect(l.scope[0]).toBe(0)
  })
  it('deals three more each when both hands are empty and the pile is not', () => {
    const s = base({ table: [c(9)], hands: [[c(2)], []], draw: [0, 1, 2, 3, 4, 5].map((i) => c(i + 1, 1)) })
    const r = play(s, 0, c(2))
    expect(r.hands[0]).toHaveLength(3)
    expect(r.hands[1]).toHaveLength(3)
    expect(r.draw).toHaveLength(0)
  })
})

describe('end of hand scoring', () => {
  it('the last capturer takes what is left on the table', () => {
    const s = base({ table: [c(9), c(8, 1)], hands: [[c(1)], []], captured: [[c(10)], [c(10, 1)]], lastCapturer: 1 })
    const r = play(s, 0, c(1))
    expect(r.phase).not.toBe('play')
    expect(r.table).toEqual([])
    expect(r.summary!.cards).toEqual([1, 4])
  })
  it('awards cards, coins, settebello, primiera and scope', () => {
    const mine = [c(7), c(6), c(1), c(5), c(2), c(3), c(4), c(10), c(9), c(8), c(7, 1), c(7, 2)]
    const theirs = [c(10, 1), c(9, 1)]
    const h = scoreHand([mine, theirs], [2, 1])
    expect(h.awards).toEqual({ cards: 0, coins: 0, settebello: 0, primiera: 0 })
    expect(h.points).toEqual([4 + 2, 1])
  })
  it('splits nothing on a tie', () => {
    const h = scoreHand([[c(1), c(2)], [c(1, 1), c(2, 1)]], [0, 0])
    expect(h.awards.cards).toBeNull()
    expect(h.points).toEqual([0 + (h.awards.coins === 0 ? 1 : 0) + (h.awards.primiera === 0 ? 1 : 0), 0 + (h.awards.primiera === 1 ? 1 : 0)])
  })
  it('primiera adds the best card of each suit', () => {
    const h = scoreHand([[c(7, 0), c(7, 1), c(7, 2), c(7, 3)], [c(6, 0), c(6, 1), c(6, 2), c(6, 3), c(1, 0)]], [0, 0])
    expect(h.primiera).toEqual([84, 72])
    expect(h.awards.primiera).toBe(0)
  })
  it('a missing suit counts nothing', () => {
    const h = scoreHand([[c(7, 0), c(7, 1), c(7, 2)], [c(1, 0), c(1, 1), c(1, 2), c(1, 3)]], [0, 0])
    expect(h.primiera).toEqual([63, 64])
    expect(h.awards.primiera).toBe(1)
  })
})

describe('the match', () => {
  it('ends at 11 with a clear leader; a tie at 11 or more plays on', () => {
    const fin = (scores: [number, number]) => {
      const s = base({ table: [], hands: [[c(1)], []], captured: [[], []], lastCapturer: null, scores })
      return play(s, 0, c(1))
    }
    expect(fin([GOAL, 0]).phase).toBe('over')
    expect(fin([GOAL, 0]).winner).toBe(0)
    expect(fin([0, GOAL + 2]).winner).toBe(1)
    expect(fin([3, 3]).phase).toBe('summary')
  })
  it('next hand swaps the dealer and keeps the scores', () => {
    const s = base({ phase: 'summary', scores: [4, 6] })
    const n = next(s)
    expect(n.phase).toBe('play')
    expect(n.dealer).toBe(1 - s.dealer)
    expect(n.scores).toEqual([4, 6])
    expect(n.hands[0]).toHaveLength(3)
    expect(n.table).toHaveLength(4)
    expect(next(n)).toBe(n)
  })
  it('scores a win above a loss', () => {
    expect(scoreFor({ ...newGame(), winner: 0, scores: [11, 7], scope: [1, 0] })).toBe(400 + 160 + 20)
    expect(scoreFor({ ...newGame(), winner: 1, scores: [8, 11] })).toBe(80)
  })
  it('validates state', () => {
    expect(isState(newGame())).toBe(true)
    expect(isState({ ...newGame(), hands: [[99], []] })).toBe(false)
    expect(isState(null)).toBe(false)
  })
})

describe('whole games', () => {
  function playOut(seed: string, level: 'easy' | 'normal' | 'hard') {
    const rnd = createRandom(`${seed}-ai`)
    let s = newGame(seed)
    let guard = 0
    while (!isOver(s) && guard++ < 2000) {
      const before = s
      if (s.phase === 'summary') s = next(s)
      else {
        const m = aiMove(s, rnd, level)!
        expect(legalMoves(s)).toContainEqual(m)
        s = play(s, s.turn, m.card, m.take)
      }
      expect(s).not.toBe(before)
    }
    return s
  }
  it('always finishes with a winner, deterministically per seed, at every level', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      const a = playOut(`g-${level}`, level)
      expect(a.phase).toBe('over')
      expect(a.winner).not.toBeNull()
      expect(Math.max(...a.scores)).toBeGreaterThanOrEqual(GOAL)
      expect(playOut(`g-${level}`, level)).toEqual(a)
    }
  })
  it('conserves all forty cards in every hand', () => {
    const rnd = createRandom('conserve')
    let s = newGame('conserve')
    for (let i = 0; i < 60 && s.phase === 'play'; i++) {
      const all = [...s.draw, ...s.table, ...s.hands[0], ...s.hands[1], ...s.captured[0], ...s.captured[1]]
      expect(new Set(all).size).toBe(40)
      expect(all).toHaveLength(40)
      const m = aiMove(s, rnd, 'normal')!
      s = play(s, s.turn, m.card, m.take)
    }
  })
})
