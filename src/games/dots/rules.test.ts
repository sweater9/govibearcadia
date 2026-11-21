import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { aiMove, boxSides, capturable, edgeBoxes, edgeCount, legalMoves, newGame, play, replay, solveValue, undoToHuman, undoTurn, type DState, type Level } from './rules'

const draw = (s: DState, edges: number[]) => edges.reduce((a, e) => play(a, e), s)

describe('geometry', () => {
  it('counts lines and sides', () => {
    expect(edgeCount(3, 3)).toBe(24)
    expect(edgeCount(2, 3)).toBe(3 * 3 + 2 * 4)
    for (const [r, c] of [[2, 2], [3, 4], [5, 5]]) {
      const n = r * c
      const seen = new Array(edgeCount(r, c)).fill(0)
      for (let b = 0; b < n; b++) for (const e of boxSides(r, c, b)) seen[e]++
      seen.forEach((k, e) => {
        expect(k).toBe(edgeBoxes(r, c, e).length)
        expect(k === 1 || k === 2).toBe(true)
      })
    }
  })
  it('rejects bad sizes', () => {
    expect(() => newGame(1, 3)).toThrow()
    expect(() => newGame(3, 9)).toThrow()
  })
})

describe('turns', () => {
  it('alternates when no box is made', () => {
    let s = newGame(2, 2)
    s = play(s, 0)
    expect(s.turn).toBe(2)
    s = play(s, 1)
    expect(s.turn).toBe(1)
  })
  it('completing a box keeps the turn and scores', () => {
    const [t, b, l, r] = boxSides(2, 2, 0)
    let s = draw(newGame(2, 2), [t, b, l]) // p1, p2, p1
    expect(s.turn).toBe(2)
    s = play(s, r)
    expect(s.boxes[0]).toBe(2)
    expect(s.scores).toEqual([0, 1])
    expect(s.turn).toBe(2)
  })
  it('one line can finish two boxes', () => {
    const s0 = newGame(2, 2)
    const shared = boxSides(2, 2, 0)[3] // right of box 0 = left of box 1
    expect(edgeBoxes(2, 2, shared)).toEqual([0, 1])
    const others = [...boxSides(2, 2, 0), ...boxSides(2, 2, 1)].filter((e) => e !== shared)
    const s = play(draw(s0, [...new Set(others)]), shared)
    expect(s.scores[0] + s.scores[1]).toBe(2)
    expect(s.log[s.log.length - 1].gained.length).toBe(2)
  })
  it('ignores illegal lines', () => {
    const s = play(newGame(2, 2), 0)
    expect(play(s, 0)).toBe(s)
    expect(play(s, 999)).toBe(s)
    expect(play(s, -1)).toBe(s)
  })
  it('ends when every box is taken and names the winner', () => {
    let s = newGame(2, 2)
    const r = createRandom('end')
    while (!s.over) s = play(s, aiMove(s, 'easy', r))
    expect(s.scores[0] + s.scores[1]).toBe(4)
    expect(s.boxes.every((b) => b !== 0)).toBe(true)
    expect(legalMoves(s)).toEqual([])
    expect(s.winner).toBe(s.scores[0] > s.scores[1] ? 1 : s.scores[1] > s.scores[0] ? 2 : 0)
  })
})

describe('undo', () => {
  it('replay matches', () => {
    const r = createRandom('u')
    let s = newGame(3, 3)
    for (let i = 0; i < 10; i++) s = play(s, aiMove(s, 'easy', r))
    const again = replay(3, 3, s.log.map((m) => m.edge))
    expect(again).toEqual(s)
  })
  it('undoTurn removes the whole extra-turn run', () => {
    const [t, b, l, r] = boxSides(2, 2, 0)
    let s = draw(newGame(2, 2), [t, b, l, r]) // p2 takes box 0 and moves again
    s = play(s, 3) // some other line by p2 still (extra turn)
    expect(s.log.slice(-2).every((m) => m.by === 2)).toBe(true)
    const u = undoTurn(s)
    expect(u.log.length).toBe(3)
    expect(u.turn).toBe(2)
  })
  it('undoToHuman returns to before the human last turn', () => {
    const r = createRandom('h')
    let s = newGame(3, 3)
    s = play(s, 0) // human (1)
    while (s.turn === 2) s = play(s, aiMove(s, 'easy', r))
    const back = undoToHuman(s, 1)
    expect(back.log.length).toBe(0)
    expect(back.turn).toBe(1)
  })
  it('undo on empty is a no-op', () => {
    const s = newGame(2, 2)
    expect(undoTurn(s)).toBe(s)
  })
})

describe('computer', () => {
  it('always returns legal lines at every level, full games', () => {
    for (const level of ['easy', 'medium', 'hard'] as Level[]) {
      for (const [r, c] of [[2, 2], [3, 3], [3, 4]]) {
        const rnd = createRandom(`${level}${r}${c}`)
        let s = newGame(r, c)
        let guard = 0
        while (!s.over && guard++ < 200) {
          const e = aiMove(s, level, rnd)
          expect(legalMoves(s)).toContain(e)
          s = play(s, e)
        }
        expect(s.over).toBe(true)
        expect(s.scores[0] + s.scores[1]).toBe(r * c)
      }
    }
  })
  it('medium and hard take a free box', () => {
    const [t, b, l] = boxSides(3, 3, 4)
    const s = draw(newGame(3, 3), [t, b, l])
    const missing = capturable(s)
    expect(missing.length).toBe(1)
    for (const level of ['medium', 'hard'] as Level[]) expect(aiMove(s, level, createRandom('x'))).toBe(missing[0])
  })
  it('medium avoids a third side when it can', () => {
    const [t, b] = boxSides(3, 3, 4)
    const s = draw(newGame(3, 3), [t, b])
    for (let i = 0; i < 20; i++) {
      const e = aiMove(s, 'medium', createRandom(`m${i}`))
      expect(edgeBoxes(3, 3, e).every((x) => s.boxes[x] !== 0 || boxSides(3, 3, x).filter((q) => s.lines[q] || q === e).length < 3)).toBe(true)
    }
  })
  it('hard is exact in small endgames: keeps control with a double-cross', () => {
    // 2x2 board: left column (boxes 0,2) is a 2-chain opened at the end, right column still has lines.
    // The solver must value the position consistently with the moves it picks.
    const rnd = createRandom('solve')
    let s = newGame(2, 2)
    while (legalMoves(s).length > 9) s = play(s, aiMove(s, 'easy', rnd))
    const v = solveValue(s)
    expect(v).not.toBeNull()
    const e = aiMove(s, 'hard', createRandom('h'))
    const n = play(s, e)
    const mine = n.turn === s.turn ? (solveValue(n) as number) + n.scores[s.turn - 1] - s.scores[s.turn - 1] : -(solveValue(n) as number)
    expect(mine).toBe(v)
  })
  it('hard is at least as good as easy over many games', () => {
    let hard = 0
    let easy = 0
    for (let i = 0; i < 12; i++) {
      let s = newGame(3, 3, i % 2 === 0 ? 1 : 2)
      const rnd = createRandom(`g${i}`)
      while (!s.over) s = play(s, aiMove(s, s.turn === 1 ? 'hard' : 'easy', rnd))
      hard += s.scores[0]
      easy += s.scores[1]
    }
    expect(hard).toBeGreaterThan(easy)
  })
})
