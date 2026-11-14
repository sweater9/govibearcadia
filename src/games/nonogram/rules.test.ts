import { describe, expect, it } from 'vitest'
import { blank, clue, colDone, filledCount, fromSolution, isSolved, newPuzzle, rowDone, setCell, type Grid } from './rules'

const gridOf = (solution: boolean[][]): Grid => solution.map((r) => r.map((v) => (v ? 1 : 0)))

describe('nonogram rules', () => {
  it('reads run lengths, with zero for an empty line', () => {
    expect(clue([true, true, false, true])).toEqual([2, 1])
    expect(clue([false, false])).toEqual([0])
    expect(clue([true, true, true])).toEqual([3])
  })
  it('deals the same puzzle for a seed and different ones for different seeds', () => {
    expect(newPuzzle('a', 8)).toEqual(newPuzzle('a', 8))
    expect(newPuzzle('a', 8).solution).not.toEqual(newPuzzle('b', 8).solution)
  })
  it('never has an empty row or column', () => {
    for (let i = 0; i < 30; i++) {
      const p = newPuzzle(`s${i}`, 10)
      expect(p.rows.every((c) => c[0] > 0)).toBe(true)
      expect(p.cols.every((c) => c[0] > 0)).toBe(true)
    }
  })
  it('is solved by the picture, and ignores marks', () => {
    const p = newPuzzle('x', 5)
    const g = gridOf(p.solution)
    expect(isSolved(p, g)).toBe(true)
    const marked = g.map((row) => row.map((v) => (v === 0 ? (2 as const) : v)))
    expect(isSolved(p, marked)).toBe(true)
    expect(isSolved(p, blank(5))).toBe(false)
  })
  it('accepts another picture that fits every clue', () => {
    const p = fromSolution([[true, false], [false, true]])
    expect(isSolved(p, [[1, 0], [0, 1]])).toBe(true)
    const q = fromSolution([[true, true], [true, true]])
    expect(isSolved(q, [[1, 1], [1, 1]])).toBe(true)
  })
  it('tracks finished rows and columns', () => {
    const p = fromSolution([[true, false], [true, true]])
    let g = blank(2)
    g = setCell(g, 0, 0, 1)
    expect(rowDone(p, g, 0)).toBe(true)
    expect(colDone(p, g, 0)).toBe(false)
    g = setCell(g, 1, 0, 1)
    expect(colDone(p, g, 0)).toBe(true)
  })
  it('setCell is pure and ignores out-of-range cells', () => {
    const g = blank(3)
    const h = setCell(g, 1, 1, 1)
    expect(g[1][1]).toBe(0)
    expect(h[1][1]).toBe(1)
    expect(setCell(g, 9, 9, 1)).toBe(g)
    expect(filledCount(h)).toBe(1)
  })
})
