import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { SIZES, conflicts, countSolutions, cycle, newGame, newPuzzle, reset, scoreFor, type Mark } from './rules'

describe('Twofold puzzles', () => {
  it('are deterministic per seed', () => {
    expect(newPuzzle(6, createRandom('t'))).toEqual(newPuzzle(6, createRandom('t')))
    expect(newPuzzle(6, createRandom('t'))).not.toEqual(newPuzzle(6, createRandom('u')))
  })

  it('have a valid full solution, givens that match it, and exactly one solution', () => {
    for (const size of SIZES) {
      for (let i = 0; i < 6; i++) {
        const p = newPuzzle(size, createRandom(`${size}-${i}`))
        expect(p.solution).not.toContain(-1)
        expect(conflicts(size, p.solution).size).toBe(0)
        p.given.forEach((g, k) => g === -1 || expect(g).toBe(p.solution[k]))
        expect(p.given).toContain(-1)
        expect(countSolutions(size, p.given)).toBe(1)
      }
    }
  })
})

describe('Twofold rules', () => {
  it('flags three in a row and over-full lines', () => {
    const c = (s: string) => [...s].map((ch) => (ch === '.' ? -1 : Number(ch))) as Mark[]
    expect([...conflicts(4, c('000.' + '....'.repeat(3)))].sort()).toEqual([0, 1, 2])
    expect([...conflicts(4, c('0.00' + '....'.repeat(3)))].sort()).toEqual([0, 2, 3]) // three 0s in a row of four
    expect(conflicts(4, c('0101' + '....'.repeat(3))).size).toBe(0)
    // Column check.
    expect(conflicts(4, c('1...1...1...' + '....')).size).toBe(3)
  })

  it('cycling changes a free cell through empty, 0, 1, empty and never touches givens', () => {
    const s = newGame(4, createRandom('cyc'))
    const free = s.cells.indexOf(-1)
    const given = s.cells.findIndex((v) => v !== -1)
    expect(cycle(s, given)).toBe(s)
    const a = cycle(s, free)
    const b = cycle(a, free)
    const c = cycle(b, free)
    expect([a.cells[free], b.cells[free], c.cells[free]]).toEqual([0, 1, -1])
  })

  it('wins exactly when the grid is full and valid, then ignores input; reset restores the givens', () => {
    const s0 = newGame(6, createRandom('win'))
    let s = s0
    const free = s0.cells.map((v, i) => (v === -1 ? i : -1)).filter((i) => i >= 0)
    for (const i of free) {
      expect(s.status).toBe('playing')
      while (s.cells[i] !== s0.puzzle.solution[i]) s = cycle(s, i)
    }
    expect(s.status).toBe('won')
    expect(cycle(s, free[0])).toBe(s)
    expect(reset(s).cells).toEqual(s0.puzzle.given)
  })

  it('scores 1000 minus 3 per second with a floor of 100', () => {
    expect([scoreFor(0), scoreFor(100), scoreFor(5000)]).toEqual([1000, 700, 100])
  })
})
