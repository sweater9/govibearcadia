import { describe, expect, it } from 'vitest'
import { COIN_R, invariantErrors, newMatch, nextBoard, remaining, resolveShot, sideOf, startingCoins, strikerAt, type ShotOutcome, type State } from './rules'

const shot = (pocketed: number[] = [], strikerPocketed = false): ShotOutcome => ({ pocketed, strikerPocketed, positions: {} })
const ids = (s: State, kind: 'white' | 'black') => s.coins.filter((c) => c.kind === kind).map((c) => c.id)

describe('layout', () => {
  it('deals 1 queen, 9 white, 9 black with no overlaps', () => {
    const s = newMatch()
    expect(s.coins).toHaveLength(19)
    expect(invariantErrors(s)).toEqual([])
    expect(startingCoins()[0].kind).toBe('queen')
  })
  it('keeps the striker on the baseline', () => {
    expect(strikerAt(0, 0).x).toBeCloseTo(370)
    expect(strikerAt(2, 5).x).toBeLessThan(370)
    expect(COIN_R).toBeGreaterThan(0)
  })
})

describe('turns', () => {
  it('own coin keeps the turn, a miss passes it', () => {
    const s = newMatch()
    const w = ids(s, 'white')[0]
    expect(resolveShot(s, shot([w])).turn).toBe(0)
    expect(resolveShot(s, shot()).turn).toBe(1)
  })
  it('opponent coin loses the turn and stays down', () => {
    const s = newMatch()
    const b = ids(s, 'black')[0]
    const r = resolveShot(s, shot([b]))
    expect(r.turn).toBe(1)
    expect(r.coins[b].pocketed).toBe(true)
  })
  it('striker pocketed returns coins and a penalty coin', () => {
    let s = newMatch()
    const [a, b] = ids(s, 'white')
    s = resolveShot(s, shot([a]))
    const r = resolveShot(s, shot([b], true))
    expect(r.turn).toBe(1)
    expect(r.coins[b].pocketed).toBe(false)
    expect(r.coins[a].pocketed).toBe(false) // penalty
  })
  it('owes a penalty when nothing is down', () => {
    const r = resolveShot(newMatch(), shot([], true))
    expect(r.owed[0]).toBe(1)
  })
  it('four players rotate clockwise and partners share a side', () => {
    const s = newMatch({ players: 4 })
    expect(resolveShot(s, shot()).turn).toBe(1)
    expect(sideOf(2)).toBe(0)
    expect(sideOf(3)).toBe(1)
  })
})

describe('queen', () => {
  it('queen alone must be covered; same shot cover scores', () => {
    const s = newMatch()
    const w = ids(s, 'white')[0]
    const r = resolveShot(s, shot([0, w]))
    expect(r.queen).toBe('covered')
    expect(r.turn).toBe(0)
  })
  it('queen first then cover on the next shot', () => {
    let s = newMatch()
    s = resolveShot(s, shot([0]))
    expect(s.queen).toBe('pending')
    expect(s.turn).toBe(0)
    s = resolveShot(s, shot([ids(s, 'white')[0]]))
    expect(s.queen).toBe('covered')
  })
  it('uncovered queen returns to the centre', () => {
    let s = newMatch()
    s = resolveShot(s, shot([0]))
    s = resolveShot(s, shot())
    expect(s.queen).toBe('board')
    expect(s.coins[0].pocketed).toBe(false)
    expect(s.turn).toBe(1)
  })
})

describe('boards and match', () => {
  const clearWhite = (s: State) => {
    for (const c of s.coins) if (c.kind === 'white') c.pocketed = true
    s.coins[0].pocketed = true
    s.queen = 'covered'
    s.queenSide = 0
  }
  it('winner scores remaining opponent coins plus the queen', () => {
    const s = newMatch()
    s.coins = s.coins.map((c) => ({ ...c }))
    for (const c of s.coins) if (c.kind === 'white') c.pocketed = true
    s.coins[0].pocketed = true
    s.queen = 'pending'
    const last = ids(s, 'white')[0]
    s.coins[last].pocketed = false
    const r = resolveShot(s, shot([last]))
    expect(r.phase).toBe('board-over')
    expect(r.scores[0]).toBe(9 + 3)
  })
  it('queen points are skipped at the cutoff', () => {
    const s = newMatch()
    clearWhite(s)
    s.scores = [22, 0]
    const last = ids(s, 'white')[0]
    s.coins[last].pocketed = false
    const r = resolveShot(s, shot([last]))
    expect(r.scores[0]).toBe(22 + 9)
    expect(r.phase).toBe('over')
    expect(r.winner).toBe(0)
  })
  it('last coin before the queen is covered is a foul', () => {
    const s = newMatch()
    for (const c of s.coins) if (c.kind === 'white') c.pocketed = true
    const last = ids(s, 'white')[0]
    s.coins[last].pocketed = false
    const r = resolveShot(s, shot([last]))
    expect(r.coins[last].pocketed).toBe(false)
    expect(r.phase).toBe('aim')
  })
  it('nextBoard resets and rotates the breaker', () => {
    const s = newMatch()
    clearWhite(s)
    const last = ids(s, 'white')[0]
    s.coins[last].pocketed = false
    const over = resolveShot(s, shot([last]))
    const n = nextBoard(over)
    expect(n.board).toBe(2)
    expect(n.turn).toBe(1)
    expect(remaining(n, 0)).toBe(9)
  })
  it('ends after the maximum boards', () => {
    const s = newMatch({ maxBoards: 1 })
    clearWhite(s)
    const last = ids(s, 'white')[0]
    s.coins[last].pocketed = false
    expect(resolveShot(s, shot([last])).phase).toBe('over')
  })
})
