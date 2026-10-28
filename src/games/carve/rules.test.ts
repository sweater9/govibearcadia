import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { SIZES, area, cellsOf, isRight, isSolved, newGame, newPuzzle, normalise, place, remove, reset, scoreFor, type Rect } from './rules'

describe('Carve puzzles', () => {
  it('are deterministic per seed', () => {
    expect(newPuzzle(7, createRandom('c'))).toEqual(newPuzzle(7, createRandom('c')))
    expect(newPuzzle(7, createRandom('c'))).not.toEqual(newPuzzle(7, createRandom('d')))
  })

  it('tile the grid exactly, carry one correct number per rectangle, and are solved by their solution', () => {
    for (const size of SIZES) {
      for (let i = 0; i < 30; i++) {
        const p = newPuzzle(size, createRandom(`${size}-${i}`))
        const all = p.solution.flatMap((r) => cellsOf(r, size))
        expect(all.sort((a, b) => a - b)).toEqual(Array.from({ length: size * size }, (_, k) => k))
        expect(Object.keys(p.numbers)).toHaveLength(p.solution.length)
        expect(p.solution.every((r) => isRight(p, r))).toBe(true)
        expect(isSolved(p, p.solution)).toBe(true)
        expect(p.solution.length).toBeGreaterThan(size) // not trivially few big pieces
      }
    }
  })
})

describe('Carve rules', () => {
  const g = () => newGame(5, createRandom('rules'))

  it('normalises any two corners into a rectangle', () => {
    expect(normalise(24, 0, 5)).toEqual({ r0: 0, c0: 0, r1: 4, c1: 4 })
    expect(normalise(7, 7, 5)).toEqual({ r0: 1, c0: 2, r1: 1, c1: 2 })
    expect(area(normalise(3, 21, 5))).toBe(15)
  })

  it('placing over an existing rectangle replaces it', () => {
    const s = g()
    const a = place(s, { r0: 0, c0: 0, r1: 1, c1: 1 })
    const b = place(a, { r0: 1, c0: 1, r1: 2, c1: 2 })
    expect(b.rects).toEqual([{ r0: 1, c0: 1, r1: 2, c1: 2 }])
    const c = place(b, { r0: 4, c0: 4, r1: 4, c1: 4 })
    expect(c.rects).toHaveLength(2)
  })

  it('remove deletes the rectangle under a cell; reset clears all', () => {
    const s = place(g(), { r0: 0, c0: 0, r1: 1, c1: 1 })
    expect(remove(s, 24)).toBe(s)
    expect(remove(s, 6).rects).toEqual([])
    expect(reset(s).rects).toEqual([])
  })

  it('wins only when the right rectangles cover everything; then ignores input', () => {
    const s0 = g()
    let s = s0
    s.puzzle.solution.forEach((r, i) => {
      expect(s.status).toBe('playing')
      s = place(s, r)
      if (i < s0.puzzle.solution.length - 1) expect(s.status).toBe('playing')
    })
    expect(s.status).toBe('won')
    expect(place(s, { r0: 0, c0: 0, r1: 0, c1: 0 })).toBe(s)
    expect(remove(s, 0)).toBe(s)
  })

  it('a wrong-area or multi-number rectangle is not right and does not win', () => {
    const p = g().puzzle
    const everything: Rect = { r0: 0, c0: 0, r1: 4, c1: 4 }
    expect(isRight(p, everything)).toBe(false)
    expect(place(g(), everything).status).toBe('playing')
  })

  it('scores 1000 minus 2 per second with a floor of 100', () => {
    expect([scoreFor(0), scoreFor(100), scoreFor(9999)]).toEqual([1000, 800, 100])
  })
})
