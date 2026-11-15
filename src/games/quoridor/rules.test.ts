import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { SIZE, WALLS, aiMove, apply, blocked, distance, isOver, isState, legalWalls, newGame, pathLength, pawnMoves, scoreFor, wallLegal, type QState, type Wall } from './rules'

const wall = (r: number, c: number, o: 'h' | 'v'): Wall => ({ r, c, o })
const state = (o: Partial<QState> = {}): QState => ({ ...newGame(), ...o })
const at = (r: number, c: number) => ({ r, c })
const sameCells = (a: { r: number; c: number }[], b: [number, number][]) => expect(a.map((p) => `${p.r},${p.c}`).sort()).toEqual(b.map((p) => `${p[0]},${p[1]}`).sort())

describe('start', () => {
  it('has pawns in the middle of the back rows and ten walls each', () => {
    const s = newGame()
    expect(s.pawns).toEqual([at(8, 4), at(0, 4)])
    expect(s.left).toEqual([WALLS, WALLS])
    expect(distance(s, 1)).toBe(8)
    expect(distance(s, 2)).toBe(8)
    expect(isState(s)).toBe(true)
  })
})

describe('walls block steps', () => {
  it('a horizontal wall blocks up and down across both of its columns, and a vertical one left and right across both rows', () => {
    const w = [wall(3, 3, 'h')]
    expect(blocked(w, 3, 3, 1, 0)).toBe(true)
    expect(blocked(w, 4, 4, -1, 0)).toBe(true)
    expect(blocked(w, 3, 2, 1, 0)).toBe(false)
    expect(blocked(w, 3, 5, 1, 0)).toBe(false)
    const v = [wall(3, 3, 'v')]
    expect(blocked(v, 3, 3, 0, 1)).toBe(true)
    expect(blocked(v, 4, 4, 0, -1)).toBe(true)
    expect(blocked(v, 5, 3, 0, 1)).toBe(false)
  })
  it('the edge of the board blocks', () => {
    expect(blocked([], 0, 0, -1, 0)).toBe(true)
    expect(blocked([], 8, 8, 0, 1)).toBe(true)
  })
})

describe('pawn moves and jumps', () => {
  it('steps in four directions from the middle', () => {
    sameCells(pawnMoves(state({ pawns: [at(4, 4), at(0, 0)] }), 1), [[3, 4], [5, 4], [4, 3], [4, 5]])
  })
  it('jumps straight over an adjacent pawn', () => {
    const s = state({ pawns: [at(4, 4), at(3, 4)] })
    sameCells(pawnMoves(s, 1), [[2, 4], [5, 4], [4, 3], [4, 5]])
  })
  it('jumps diagonally when a wall is behind the pawn', () => {
    const s = state({ pawns: [at(4, 4), at(3, 4)], walls: [wall(2, 4, 'h')] })
    sameCells(pawnMoves(s, 1), [[3, 3], [3, 5], [5, 4], [4, 3], [4, 5]])
  })
  it('jumps diagonally when the pawn is against the edge, but not through a wall beside it', () => {
    const s = state({ pawns: [at(1, 4), at(0, 4)], walls: [wall(0, 4, 'v')] })
    const moves = pawnMoves(s, 1)
    expect(moves.some((p) => p.r === 0 && p.c === 3)).toBe(true)
    expect(moves.some((p) => p.r === 0 && p.c === 5)).toBe(false)
  })
  it('cannot step through a wall or onto the other pawn', () => {
    const s = state({ pawns: [at(4, 4), at(3, 4)], walls: [wall(3, 4, 'h')] })
    expect(apply(s, { type: 'pawn', to: at(3, 4) })).toBe(s)
    expect(apply(s, { type: 'pawn', to: at(2, 4) })).toBe(s)
  })
  it('moving to the goal row wins and ends the game', () => {
    const s = state({ pawns: [at(1, 4), at(8, 0)] })
    const n = apply(s, { type: 'pawn', to: at(0, 4) })
    expect(n.winner).toBe(1)
    expect(isOver(n)).toBe(true)
    expect(apply(n, { type: 'pawn', to: at(1, 4) })).toBe(n)
  })
})

describe('placing walls', () => {
  it('uses one wall, passes the turn and lengthens the opponent path', () => {
    const s = newGame()
    const n = apply(s, { type: 'wall', wall: wall(0, 3, 'h') })
    expect(n.left).toEqual([9, 10])
    expect(n.turn).toBe(2)
    expect(distance(n, 2)).toBeGreaterThan(8)
  })
  it('refuses overlaps, crossings and off-board walls', () => {
    const s = state({ walls: [wall(3, 3, 'h')] })
    expect(wallLegal(s, wall(3, 3, 'h'))).toBe(false)
    expect(wallLegal(s, wall(3, 3, 'v'))).toBe(false)
    expect(wallLegal(s, wall(3, 2, 'h'))).toBe(false)
    expect(wallLegal(s, wall(3, 4, 'h'))).toBe(false)
    expect(wallLegal(s, wall(3, 5, 'h'))).toBe(true)
    expect(wallLegal(s, wall(8, 0, 'h'))).toBe(false)
    expect(wallLegal(s, wall(0, 8, 'v'))).toBe(false)
    expect(wallLegal(s, { r: 1, c: 1, o: 'x' as 'h' })).toBe(false)
  })
  it('refuses a wall that would seal a pawn in', () => {
    // Player 2 is in the top-left 2x2 corner; one wall below it is fine, but the wall that closes its right side is not.
    const s = state({ pawns: [at(8, 4), at(0, 0)], walls: [wall(1, 0, 'h')], turn: 1 })
    expect(wallLegal(s, wall(0, 1, 'v'))).toBe(false)
    expect(wallLegal(s, wall(0, 3, 'v'))).toBe(true)
    expect(pathLength([...s.walls, wall(0, 1, 'v')], at(0, 0), 8)).toBe(Infinity)
  })
  it('cannot place a wall with none left', () => {
    const s = state({ left: [0, 10] })
    expect(wallLegal(s, wall(0, 0, 'h'))).toBe(false)
    expect(apply(s, { type: 'wall', wall: wall(0, 0, 'h') })).toBe(s)
  })
  it('legalWalls lists all 128 on an empty board', () => {
    expect(legalWalls(newGame())).toHaveLength(128)
  })
})

describe('score and validation', () => {
  it('pays a win above a loss, and walls to spare count', () => {
    const win = scoreFor(state({ winner: 1, left: [10, 5], moves: 20 }))
    const less = scoreFor(state({ winner: 1, left: [2, 5], moves: 20 }))
    expect(win).toBeGreaterThan(less)
    expect(scoreFor(state({ winner: 2, pawns: [at(4, 4), at(8, 0)] }))).toBe(40)
  })
  it('rejects malformed state', () => {
    expect(isState({ ...newGame(), left: [11, 0] })).toBe(false)
    expect(isState({ ...newGame(), pawns: [at(9, 9), at(0, 0)] })).toBe(false)
    expect(isState(null)).toBe(false)
  })
})

describe('computer', () => {
  it('takes the winning step when it is one away, and blocks a runner that is about to win', () => {
    const win = state({ pawns: [at(8, 4), at(7, 2)], turn: 2 })
    expect(aiMove(win, createRandom('a'), 'normal')).toEqual({ type: 'pawn', to: at(8, 2) })
    const race = state({ pawns: [at(1, 4), at(0, 0)], turn: 2 })
    const m = aiMove(race, createRandom('b'), 'hard')!
    const after = apply(race, m)
    expect(after.winner).toBe(0)
    expect(distance(after, 1)).toBeGreaterThan(1)
  })
  it('plays whole games legally at every level, and is deterministic for a seed', () => {
    for (const level of ['easy', 'normal'] as const) {
      const run = () => {
        const rnd = createRandom(`q-${level}`)
        let s = newGame()
        for (let i = 0; i < 300 && !isOver(s); i++) {
          const m = aiMove(s, rnd, level)!
          const n = apply(s, m)
          expect(n).not.toBe(s)
          s = n
        }
        return s
      }
      const a = run()
      expect(isOver(a)).toBe(true)
      expect(run()).toEqual(a)
    }
    expect(SIZE).toBe(9)
  })
})
