import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { DEFAULT_RULES, EIGHT, aiMove, applyMove, canDraw, draw, finishRound, handPoints, handSize, isEight, isLegal, isOver, legalPlays, newRound, nextRound, play, points, rankOf, roundPoints, startMatch, suitOf, topCard, type CState, type Level, type Rules } from './rules'

const card = (rank: number, suit: number) => suit * 13 + rank
/** A hand-built state for exact rule checks. */
function make(over: Partial<CState> = {}): CState {
  const base = newRound('fixture', 2)
  return { ...base, ...over }
}
const all = (s: CState) => [...s.stock, ...s.discard, ...s.hands.flat()]

describe('dealing', () => {
  it('deals seven cards for two players and five for three or four, from a full 52-card deck', () => {
    for (const [players, n] of [[2, 7], [3, 5], [4, 5]] as const) {
      const s = newRound('deal', players)
      expect(handSize(players)).toBe(n)
      s.hands.forEach((h) => expect(h).toHaveLength(n))
      expect([...all(s)].sort((a, b) => a - b)).toEqual(Array.from({ length: 52 }, (_, i) => i))
      expect(s.discard).toHaveLength(1)
    }
  })
  it('never starts on an eight, and the starter sets the suit', () => {
    for (let i = 0; i < 300; i++) {
      const s = newRound(`start-${i}`, 2 + (i % 3))
      expect(isEight(topCard(s))).toBe(false)
      expect(s.suit).toBe(suitOf(topCard(s)))
    }
  })
  it('deals the same way for the same seed and rejects bad player counts', () => {
    expect(newRound('x', 3).hands).toEqual(newRound('x', 3).hands)
    expect(newRound('x', 3).hands).not.toEqual(newRound('y', 3).hands)
    expect(() => newRound('x', 1)).toThrow()
    expect(() => newRound('x', 5)).toThrow()
  })
})

describe('legal plays', () => {
  const s = make({ hands: [[card(2, 0), card(2, 1), card(9, 1), card(EIGHT, 3), card(4, 2)], [card(0, 0)]], discard: [card(2, 2)], suit: 2, stock: [card(5, 3)] })
  it('allows a match by suit, a match by rank, and any eight', () => {
    expect(legalPlays(s).sort((a, b) => a - b)).toEqual([card(2, 0), card(2, 1), card(EIGHT, 3), card(4, 2)].sort((a, b) => a - b))
    expect(isLegal(s, card(9, 1))).toBe(false)
  })
  it('does not let you play a card you do not hold or play out of turn', () => {
    expect(isLegal(s, card(0, 0))).toBe(false)
    expect(play(s, card(0, 0))).toBe(s)
  })
})

describe('eights', () => {
  const s = make({ hands: [[card(EIGHT, 1), card(3, 0)], [card(5, 2), card(6, 3)]], discard: [card(9, 2)], suit: 2, stock: [card(1, 1)] })
  it('need a suit to be named and then set the suit to match', () => {
    expect(play(s, card(EIGHT, 1))).toBe(s)
    const t = play(s, card(EIGHT, 1), 3)
    expect(t.suit).toBe(3)
    expect(t.turn).toBe(1)
    expect(isLegal(t, card(6, 3))).toBe(true)
    expect(isLegal(t, card(5, 2))).toBe(false)
  })
  it('can be played on anything, even a different suit and rank', () => {
    const t = make({ hands: [[card(EIGHT, 0)], [card(1, 1)]], discard: [card(4, 3)], suit: 3 })
    expect(isLegal(t, card(EIGHT, 0))).toBe(true)
  })
  it('cannot be the last card when noEightFinish is on', () => {
    const rules: Rules = { ...DEFAULT_RULES, noEightFinish: true }
    const t = make({ rules, hands: [[card(EIGHT, 0)], [card(1, 1)]], discard: [card(4, 3)], suit: 3, stock: [card(2, 2)] })
    expect(isLegal(t, card(EIGHT, 0))).toBe(false)
    const u = make({ rules, hands: [[card(EIGHT, 0), card(4, 0)], [card(1, 1)]], discard: [card(4, 3)], suit: 3 })
    expect(isLegal(u, card(EIGHT, 0))).toBe(true)
  })
})

describe('drawing', () => {
  it('is only allowed with no legal play, and gives the player a card', () => {
    const t = make({ hands: [[card(1, 0), card(3, 0)], [card(1, 1)]], discard: [card(9, 2)], suit: 2, stock: [card(11, 2), card(5, 1)] })
    expect(draw(make({ hands: [[card(9, 0)], [card(1, 1)]], discard: [card(9, 2)], suit: 2, stock: [card(5, 1)] }))).toMatchObject({ turn: 0 })
    const d = draw(t)
    expect(d.hands[0]).toContain(card(5, 1))
    expect(d.stock).toEqual([card(11, 2)])
  })
  it('until-rule: the player keeps drawing until a card can be played', () => {
    const t = make({ hands: [[card(1, 0)], [card(1, 1)]], discard: [card(9, 2)], suit: 2, stock: [card(11, 2), card(5, 1), card(6, 1)] })
    const a = draw(t)
    expect(a.turn).toBe(0)
    expect(legalPlays(a)).toHaveLength(0)
    const b = draw(a)
    expect(b.turn).toBe(0)
    const c = draw(b)
    expect(c.turn).toBe(0)
    expect(legalPlays(c)).toContain(card(11, 2))
  })
  it('one-card rule: after one unplayable draw the turn passes', () => {
    const rules: Rules = { drawRule: 'one', noEightFinish: false }
    const t = make({ rules, hands: [[card(1, 0)], [card(1, 1)]], discard: [card(9, 2)], suit: 2, stock: [card(5, 1), card(6, 1)] })
    const d = draw(t)
    expect(d.turn).toBe(1)
    expect(d.hands[0]).toHaveLength(2)
  })
  it('a drawn playable card can be played at once', () => {
    const rules: Rules = { drawRule: 'one', noEightFinish: false }
    const t = make({ rules, hands: [[card(1, 0)], [card(1, 1)]], discard: [card(9, 2)], suit: 2, stock: [card(5, 2)] })
    const d = draw(t)
    expect(d.turn).toBe(0)
    expect(legalPlays(d)).toEqual([card(5, 2)])
  })
})

describe('reshuffling and blocked rounds', () => {
  it('reshuffles the discard pile (keeping the top card) when the stock is empty', () => {
    const t = make({ hands: [[card(1, 0)], [card(1, 1)]], stock: [], discard: [card(3, 3), card(5, 3), card(7, 3), card(9, 2)], suit: 2 })
    expect(canDraw(t)).toBe(true)
    const d = draw(t)
    expect(d.reshuffles).toBe(1)
    expect(topCard(d)).toBe(card(9, 2))
    expect(d.discard).toEqual([card(9, 2)])
    expect(d.hands[0]).toHaveLength(2)
    expect(d.stock).toHaveLength(2)
    expect(new Set(all(d)).size).toBe(all(d).length)
  })
  it('a player who cannot play or draw passes, and when everyone is stuck the round is blocked and goes to the lowest hand', () => {
    // P0 plays an eight naming hearts. P1 holds no heart, draws the two clubs left under the top card (neither can be
    // played), and then neither player can play or draw.
    const t = make({ hands: [[card(EIGHT, 2), card(3, 0), card(1, 0)], [card(0, 0)]], stock: [], discard: [card(2, 3), card(4, 3), card(8, 2)], suit: 2 })
    const a = play(t, card(EIGHT, 2), 1)
    expect(a.turn).toBe(1)
    let b = a
    for (let i = 0; i < 5 && !isOver(b); i++) b = draw(b)
    expect(isOver(b)).toBe(true)
    expect(b.blocked).toBe(true)
    // P0 holds 4 + 2 = 6 points; P1 holds ace + three + five + nine = 18 points, so P0 wins and scores P1's hand.
    expect(b.winner).toBe(0)
    expect(roundPoints(b)).toBe(18)
  })
  it('a stuck player is skipped without ending the round while someone can still move', () => {
    const t = make({ hands: [[card(8, 2), card(4, 0)], [card(0, 1), card(1, 1)], [card(2, 2)]], players: 3, voids: [[false, false, false, false], [false, false, false, false], [false, false, false, false]], stock: [], discard: [card(3, 3), card(5, 2)], suit: 2 })
    const a = play(t, card(8, 2))
    expect(isOver(a)).toBe(false)
  })
})

describe('winning and points', () => {
  it('going out wins the round and scores the other hands', () => {
    const t = make({ hands: [[card(4, 2)], [card(EIGHT, 0), card(12, 1), card(0, 3)]], discard: [card(9, 2)], suit: 2 })
    const w = play(t, card(4, 2))
    expect(isOver(w)).toBe(true)
    expect(w.winner).toBe(0)
    expect(roundPoints(w)).toBe(50 + 10 + 1)
  })
  it('scores cards: eight 50, face and ten 10, ace 1, others face value', () => {
    expect(points(card(EIGHT, 0))).toBe(50)
    expect([9, 10, 11, 12].map((r) => points(card(r, 0)))).toEqual([10, 10, 10, 10])
    expect(points(card(0, 0))).toBe(1)
    expect(points(card(1, 0))).toBe(2)
    expect(points(card(8, 0))).toBe(9)
    expect(handPoints([card(EIGHT, 0), card(0, 1), card(5, 2)])).toBe(57)
  })
})

describe('a match', () => {
  it('banks a round once, rotates the first player and ends at the target', () => {
    let m = startMatch('m', 2, 1, DEFAULT_RULES, 50)
    expect(finishRound(m)).toBe(m) // nothing to bank yet
    const won = play(make({ hands: [[card(4, 2)], [card(EIGHT, 0), card(12, 1), card(0, 3), card(7, 1)]], discard: [card(9, 2)], suit: 2 }), card(4, 2))
    m = { ...m, round: won }
    const banked = finishRound(m)
    expect(banked.scores).toEqual([50 + 10 + 1 + 50, 0])
    expect(banked.history).toHaveLength(1)
    expect(finishRound(banked)).toBe(banked) // never twice
    expect(banked.over).toBe(true)
    expect(banked.winner).toBe(0)
    expect(nextRound(banked)).toBe(banked) // finished match: no next round
    const open = startMatch('m2', 3, 1, DEFAULT_RULES, 500)
    const r1 = finishRound({ ...open, round: play(make({ players: 3, hands: [[card(4, 2)], [card(1, 1)], [card(2, 1)]], discard: [card(9, 2)], suit: 2, voids: [[false, false, false, false], [false, false, false, false], [false, false, false, false]] }), card(4, 2)) })
    const r2 = nextRound(r1)
    expect(r2.banked).toBe(false)
    expect(r2.round.turn).toBe(1)
    expect(r2.round.winner).toBeNull()
  })
})

describe('the computer', () => {
  const levels: Level[] = ['beginner', 'normal', 'advanced']

  /** Plays one full round with computers in every seat, checking the rules at every step. */
  function playRound(seed: string, players: number, levelsBySeat: Level[], rules: Rules = DEFAULT_RULES) {
    const random = createRandom(`${seed}:ai`)
    let s = newRound(seed, players, rules)
    for (let i = 0; i < 4000 && !isOver(s); i++) {
      const m = aiMove(s, levelsBySeat[s.turn], random)
      if (m.kind === 'play') {
        expect(isLegal(s, m.card)).toBe(true)
        if (isEight(m.card)) expect([0, 1, 2, 3]).toContain(m.suit)
      } else {
        expect(legalPlays(s)).toHaveLength(0)
      }
      const before = all(s).length
      s = applyMove(s, m)
      expect(new Set(all(s)).size).toBe(52)
      expect(all(s).length).toBe(before)
    }
    return s
  }

  it('always plays legally, never loses a card, and every round ends (all levels, 2 to 4 players, both draw rules)', () => {
    for (let i = 0; i < 40; i++) {
      for (const players of [2, 3, 4]) {
        const lv = Array.from({ length: players }, (_, k) => levels[(i + k) % 3])
        const rules: Rules = { drawRule: i % 2 ? 'one' : 'until', noEightFinish: i % 5 === 0 }
        const end = playRound(`sim-${i}-${players}`, players, lv, rules)
        expect(isOver(end)).toBe(true)
        if (!end.blocked) expect(end.hands[end.winner as number]).toHaveLength(0)
      }
    }
  })

  it('the advanced computer beats the beginner over many seeded two-player rounds', () => {
    let adv = 0
    let beg = 0
    for (let i = 0; i < 120; i++) {
      const advFirst = i % 2 === 0
      const end = playRound(`duel-${i}`, 2, advFirst ? ['advanced', 'beginner'] : ['beginner', 'advanced'])
      const w = end.winner as number
      const advWon = advFirst ? w === 0 : w === 1
      if (advWon) adv++
      else beg++
    }
    expect(adv).toBeGreaterThan(beg)
  })

  it('does not waste an eight when an ordinary card will do (normal and advanced)', () => {
    const s = make({ hands: [[card(EIGHT, 0), card(4, 2), card(6, 3), card(9, 3)], [card(1, 1), card(2, 1), card(3, 1)]], discard: [card(9, 2)], suit: 2 })
    for (const level of ['normal', 'advanced'] as const) {
      const m = aiMove(s, level, createRandom('x'))
      expect(m.kind === 'play' && !isEight(m.card)).toBe(true)
    }
  })

  it('names the suit it holds most of when it has to play an eight', () => {
    const s = make({ hands: [[card(EIGHT, 0), card(1, 3), card(2, 3), card(3, 3), card(4, 1)], [card(1, 1), card(2, 1), card(3, 1)]], discard: [card(9, 2)], suit: 2 })
    const m = aiMove(s, 'normal', createRandom('y'))
    expect(m).toMatchObject({ kind: 'play', card: card(EIGHT, 0), suit: 3 })
  })

  it('draws when it cannot play', () => {
    const s = make({ hands: [[card(1, 0)], [card(1, 1)]], discard: [card(9, 2)], suit: 2, stock: [card(5, 1)] })
    expect(aiMove(s, 'advanced', createRandom('z'))).toEqual({ kind: 'draw' })
  })

  it('rank of a played card matches by rank across suits', () => {
    const s = make({ hands: [[card(9, 0)], [card(1, 1)]], discard: [card(9, 2)], suit: 2 })
    expect(isLegal(s, card(9, 0))).toBe(true)
    expect(rankOf(card(9, 0))).toBe(rankOf(topCard(s)))
  })
})
