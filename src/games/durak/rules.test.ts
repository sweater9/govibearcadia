import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { HAND, aiAttack, aiDefend, attack, beats, canEnd, cardName, defend, done, isOver, isState, legalAttacks, legalDefences, newGame, other, rankOf, scoreFor, suitOf, take, toAct, type DState, type Level, type Who } from './rules'

/** Card id from a suit (0 to 3) and rank (6..14 as in 6..ace). */
const c = (suit: number, rank: number) => suit * 9 + (rank - 6)

function base(over: Partial<DState> = {}): DState {
  return { ...newGame('t'), trump: 1, trumpCard: c(1, 6), deck: [c(1, 6), c(3, 6), c(3, 7), c(3, 8), c(3, 9), c(3, 10)], hands: [[], []], attacker: 0, table: [], phase: 'attack', limit: 6, ...over }
}

describe('the deal', () => {
  it('uses 36 distinct cards, deals six each, and the trump is the bottom card', () => {
    const s = newGame('deal')
    expect(s.hands[0]).toHaveLength(HAND)
    expect(s.hands[1]).toHaveLength(HAND)
    expect(s.deck).toHaveLength(36 - 12)
    expect(new Set([...s.deck, ...s.hands[0], ...s.hands[1]]).size).toBe(36)
    expect(s.trump).toBe(suitOf(s.deck[0]))
    expect(s.trumpCard).toBe(s.deck[0])
    expect(newGame('deal')).toEqual(s)
    expect(isState(s)).toBe(true)
  })
  it('the player with the lowest trump attacks first', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const s = newGame(seed)
      const low = (h: number[]) => Math.min(...h.filter((x) => suitOf(x) === s.trump).map(rankOf), 99)
      const expected: Who = low(s.hands[1]) < low(s.hands[0]) ? 1 : 0
      expect(s.attacker).toBe(expected)
    }
  })
})

describe('beating', () => {
  it('same suit higher, or a trump on a plain card, never a plain card on a trump', () => {
    const s = base()
    expect(beats(s, c(0, 7), c(0, 9))).toBe(true)
    expect(beats(s, c(0, 9), c(0, 7))).toBe(false)
    expect(beats(s, c(0, 14), c(1, 6))).toBe(true)
    expect(beats(s, c(1, 6), c(0, 14))).toBe(false)
    expect(beats(s, c(1, 7), c(1, 9))).toBe(true)
    expect(beats(s, c(0, 7), c(2, 14))).toBe(false)
  })
})

describe('a bout', () => {
  it('the attacker leads any card; only a legal defence is accepted; the defender cannot lead', () => {
    let s = base({ hands: [[c(0, 7), c(2, 8)], [c(0, 9), c(2, 6)]] })
    expect(legalAttacks(s)).toHaveLength(2)
    expect(attack(s, 1, c(0, 9))).toBe(s)
    s = attack(s, 0, c(0, 7))
    expect(s.phase).toBe('defend')
    expect(toAct(s)).toBe(1)
    expect(defend(s, 1, c(2, 6))).toBe(s)
    expect(defend(s, 0, c(0, 9))).toBe(s)
    expect(legalDefences(s)).toEqual([{ card: c(0, 9), index: 0 }])
    const d = defend(s, 1, c(0, 9))
    expect(d.phase === 'attack' || d.phase === 'over' || d.attacker !== s.attacker).toBe(true)
  })
  it('the attacker may only add ranks already on the table, up to the limit', () => {
    let s = base({ hands: [[c(0, 7), c(2, 7), c(3, 9), c(2, 12)], [c(0, 9), c(0, 10), c(0, 11), c(0, 12)]], limit: 2 })
    s = attack(s, 0, c(0, 7))
    s = defend(s, 1, c(0, 9))
    expect(s.phase).toBe('attack')
    expect(canEnd(s)).toBe(true)
    // Only the 7 (matches attack) and the 9 (matches defence) are allowed.
    expect(legalAttacks(s).sort()).toEqual([c(2, 7), c(3, 9)].sort())
    expect(attack(s, 0, c(2, 12))).toBe(s)
    s = attack(s, 0, c(2, 7))
    // Two attacks reached the limit, so no more can be added.
    expect(legalAttacks(s)).toEqual([])
  })
  it('a held defence ends the bout: both refill attacker first, roles swap', () => {
    const s0 = base({ hands: [[c(0, 7), c(0, 8)], [c(0, 9), c(3, 14)]], limit: 2 })
    let s = attack(s0, 0, c(0, 7))
    s = defend(s, 1, c(0, 9))
    s = done(s, 0)
    expect(s.attacker).toBe(1)
    expect(s.table).toEqual([])
    // The attacker draws first (5 of the 6 cards left), so the defender only gets the last one.
    expect(s.hands[0]).toHaveLength(HAND)
    expect(s.hands[1]).toHaveLength(2)
    expect(s.deck).toEqual([])
    expect(s.bouts).toBe(1)
  })
  it('taking: the defender gets the table and the attacker may add matching cards, then the same attacker leads again', () => {
    const s0 = base({ hands: [[c(0, 7), c(2, 7), c(3, 8)], [c(2, 9), c(3, 13)]], limit: 2, deck: [c(1, 6), c(3, 6), c(3, 7), c(3, 9), c(3, 10), c(3, 11), c(3, 12), c(2, 13)] })
    let s = attack(s0, 0, c(0, 7))
    s = take(s, 1)
    expect(s.phase).toBe('take')
    expect(canEnd(s)).toBe(true)
    s = attack(s, 0, c(2, 7))
    expect(s.phase === 'attack' && s.attacker === 0).toBe(true)
    expect(s.hands[1]).toEqual(expect.arrayContaining([c(0, 7), c(2, 7), c(2, 9), c(3, 13)]))
    expect(s.hands[0]).toHaveLength(HAND)
  })
  it('only the right player can end the bout, and only when it is allowed', () => {
    const s = base({ hands: [[c(0, 7)], [c(0, 9)]] })
    expect(done(s, 0)).toBe(s)
    const a = attack(s, 0, c(0, 7))
    expect(done(a, 0)).toBe(a)
    expect(take(a, 0)).toBe(a)
  })
})

describe('ending the game', () => {
  it('with the deck gone, emptying your hand wins and the other is the durak', () => {
    const s0 = base({ deck: [], hands: [[c(0, 7)], [c(0, 9), c(2, 8)]], limit: 1 })
    let s = attack(s0, 0, c(0, 7))
    s = defend(s, 1, c(0, 9))
    expect(isOver(s)).toBe(true)
    expect(s.winner).toBe(0)
    expect(s.durak).toBe(1)
    expect(scoreFor(s)).toBeGreaterThan(400)
  })
  it('the defender emptying their hand while beating the last attack wins', () => {
    const s0 = base({ deck: [], hands: [[c(0, 7), c(2, 8)], [c(0, 9)]], limit: 1 })
    let s = attack(s0, 0, c(0, 7))
    s = defend(s, 1, c(0, 9))
    expect(s.winner).toBe(1)
    expect(s.durak).toBe(0)
    expect(scoreFor(s)).toBe(0)
  })
  it('both hands empty together is a draw', () => {
    const s0 = base({ deck: [], hands: [[c(0, 7)], [c(0, 9)]], limit: 1 })
    let s = attack(s0, 0, c(0, 7))
    s = defend(s, 1, c(0, 9))
    expect(s.draw).toBe(true)
    expect(s.winner).toBeNull()
    expect(scoreFor(s)).toBe(150)
    expect(attack(s, 0, 0)).toBe(s)
  })
  it('taking the last cards does not end the game', () => {
    const s0 = base({ deck: [], hands: [[c(0, 7)], [c(2, 9)]], limit: 1 })
    let s = attack(s0, 0, c(0, 7))
    s = take(s, 1)
    expect(isOver(s)).toBe(true)
    expect(s.winner).toBe(0)
    expect(s.hands[1]).toHaveLength(2)
  })
})

describe('whole games', () => {
  function playOut(seed: string, level: Level, other2: Level = level) {
    const rnd = createRandom(`${seed}-ai`)
    let s = newGame(seed)
    for (let g = 0; g < 2000 && !isOver(s); g++) {
      const who = toAct(s)!
      const lv = who === 0 ? level : other2
      let n = s
      if (s.phase === 'defend') {
        const m = aiDefend(s, who, lv, rnd)
        n = m === 'take' ? take(s, who) : defend(s, who, m.card, m.index)
      } else {
        const m = aiAttack(s, who, lv, rnd)
        n = m === 'done' ? done(s, who) : attack(s, who, m)
      }
      expect(n).not.toBe(s)
      s = n
    }
    return s
  }
  it('always finishes, with every card accounted for, at every level, deterministically', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      for (const seed of ['w1', 'w2', 'w3']) {
        const a = playOut(seed, level)
        expect(isOver(a)).toBe(true)
        expect(a.winner !== null || a.draw).toBe(true)
        expect(new Set([...a.hands[0], ...a.hands[1], ...a.deck]).size).toBe(a.hands[0].length + a.hands[1].length + a.deck.length)
        expect(playOut(seed, level)).toEqual(a)
      }
    }
  })
  it('a normal player beats an easy one more often than not', () => {
    let wins = 0
    let games = 0
    for (let i = 0; i < 24; i++) {
      const a = playOut(`m${i}`, 'normal', 'easy')
      if (a.winner !== null) {
        games++
        if (a.winner === 0) wins++
      }
    }
    expect(games).toBeGreaterThan(10)
    expect(wins / games).toBeGreaterThan(0.5)
  })
  it('names cards readably and flips players', () => {
    expect(cardName(c(1, 14))).toBe('A♥')
    expect(cardName(c(0, 10))).toBe('10♠')
    expect(other(0)).toBe(1)
  })
})
