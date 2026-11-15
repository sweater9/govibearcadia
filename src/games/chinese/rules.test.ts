import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { DIRS, JUMP, N, POINTS, STEP, TIP, TURN_LIMIT, aiMove, destinations, goalTip, isOver, isState, legalMoves, move, newGame, progress, scoreFor, startTip, tipPoints, type CState, type Count } from './rules'

const idx = (x: number, y: number, z: number) => POINTS.findIndex((p) => p[0] === x && p[1] === y && p[2] === z)

describe('board', () => {
  it('is a 121-point star with six tips of ten and a hexagon of sixty-one', () => {
    expect(N).toBe(121)
    for (let t = 0; t < 6; t++) expect(tipPoints(t)).toHaveLength(10)
    expect(TIP.filter((t) => t < 0)).toHaveLength(61)
    expect(new Set(POINTS.map((p) => p.join())).size).toBe(121)
  })
  it('has symmetric adjacency, and hops land two points away', () => {
    for (let i = 0; i < N; i++)
      for (let d = 0; d < 6; d++) {
        const a = STEP[i][d]
        if (a >= 0) expect(STEP[a][(d + 3) % 6]).toBe(i)
        const j = JUMP[i][d]
        if (j >= 0) expect(STEP[a][d]).toBe(j)
      }
    expect(DIRS).toHaveLength(6)
  })
  it('opposite tips are three apart, and each player has ten men on their own tip', () => {
    for (const n of [2, 3, 4, 6] as Count[]) {
      const s = newGame(n)
      for (let p = 1; p <= n; p++) {
        expect(s.cells.filter((c) => c === p)).toHaveLength(10)
        expect(goalTip(n, p)).toBe((startTip(n, p) + 3) % 6)
      }
      expect(s.cells.filter((c) => c).length).toBe(10 * n)
    }
  })
})

describe('moves', () => {
  it('a man at the start can step to an adjacent hole and hop over a neighbour', () => {
    const s = newGame(2)
    const front = tipPoints(4).map((i) => ({ i, n: destinations(s, i).length })).filter((m) => m.n > 0)
    expect(front.length).toBeGreaterThan(0)
    expect(legalMoves(s).length).toBeGreaterThan(0)
  })
  it('chains hops in one turn and may not stop on an occupied point', () => {
    const s = newGame(2)
    s.cells.fill(0)
    const a = idx(0, 0, 0)
    s.cells[a] = 1
    s.cells[idx(1, -1, 0)] = 2
    s.cells[idx(3, -3, 0)] = 2 // hop over (1,-1,0) lands (2,-2,0), then over (3,-3,0) lands (4,-4,0)
    const d = destinations(s, a)
    expect(d).toContain(idx(2, -2, 0))
    expect(d).toContain(idx(4, -4, 0))
    expect(d).not.toContain(idx(1, -1, 0))
    expect(d).not.toContain(idx(3, -3, 0))
  })
  it('cannot move an opponent man, out of turn, or to an unreachable point', () => {
    const s = newGame(2)
    const mine = s.cells.findIndex((c) => c === 1)
    const theirs = s.cells.findIndex((c) => c === 2)
    expect(move(s, theirs, 0)).toBe(s)
    expect(move(s, mine, idx(8, -4, -4))).toBe(s)
    expect(move(s, -1, 3)).toBe(s)
    expect(move(s, 1.5, 3)).toBe(s)
  })
  it('passes the turn around all players in order', () => {
    let s = newGame(3)
    const seen: number[] = []
    const r = createRandom('turn')
    for (let i = 0; i < 6; i++) {
      seen.push(s.turn)
      const m = aiMove(s, r, 'easy')!
      s = move(s, m.from, m.to)
    }
    expect(seen).toEqual([1, 2, 3, 1, 2, 3])
  })
})

describe('winning', () => {
  it('fills the opposite tip to win, and nothing more can be played', () => {
    let s = newGame(2)
    s.cells.fill(0)
    const goal = tipPoints(goalTip(2, 1))
    // The last hole is on the base edge of the tip, one step from a point outside it.
    const last = goal.find((i) => STEP[i].some((n) => n >= 0 && !goal.includes(n)))!
    for (const i of goal) if (i !== last) s.cells[i] = 1
    const from = STEP[last].find((n) => n >= 0 && !goal.includes(n))!
    s.cells[from] = 1
    s.cells[tipPoints(startTip(2, 1))[0]] = 2
    s = move(s, from, last)
    expect(s.winner).toBe(1)
    expect(isOver(s)).toBe(true)
    expect(legalMoves(s)).toEqual([])
    expect(scoreFor(s)).toBeGreaterThan(500)
  })
  it('progress runs from 0 at the start to 100 at home', () => {
    const s = newGame(2)
    expect(progress(s, 1)).toBe(0)
    const home = { ...s, cells: s.cells.map((c, i) => (TIP[i] === goalTip(2, 1) ? 1 : 0)) }
    expect(progress(home, 1)).toBe(100)
  })
  it('validates state', () => {
    expect(isState(newGame(4))).toBe(true)
    expect(isState({ ...newGame(), players: 5 })).toBe(false)
    expect(isState(null)).toBe(false)
  })
})

describe('computer', () => {
  function playOut(players: Count, level: 'easy' | 'normal' | 'hard', seed: string) {
    const r = createRandom(seed)
    let s: CState = newGame(players)
    for (let g = 0; g < players * TURN_LIMIT + 10 && !isOver(s); g++) {
      const m = aiMove(s, r, level)!
      const n = move(s, m.from, m.to)
      expect(n).not.toBe(s)
      s = n
    }
    return s
  }
  it('plays legal moves to a finish, deterministically for a seed', () => {
    const a = playOut(2, 'normal', 'cc')
    expect(isOver(a)).toBe(true)
    expect(playOut(2, 'normal', 'cc')).toEqual(a)
  })
  it('a normal player gets all the way home against a normal player well inside the limit', () => {
    const a = playOut(2, 'normal', 'cc2')
    expect(a.called).toBe(false)
  })
  it('hard finishes a three-player game and easy a six-player game', () => {
    expect(isOver(playOut(3, 'hard', 'h3'))).toBe(true)
    expect(isOver(playOut(6, 'easy', 'e6'))).toBe(true)
  })
})
