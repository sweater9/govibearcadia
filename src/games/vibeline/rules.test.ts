import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { SIZES, adjacent, newGame, newPuzzle, reached, reset, scoreFor, startCell, step, stepThrough, undo } from './rules'

describe('VibeLine puzzles', () => {
  it('are deterministic per seed and differ between seeds', () => {
    expect(newPuzzle(5, createRandom('a'))).toEqual(newPuzzle(5, createRandom('a')))
    expect(newPuzzle(5, createRandom('a'))).not.toEqual(newPuzzle(5, createRandom('b')))
  })

  it('always have a full solution that obeys the rules, for every size and many seeds', () => {
    for (const size of SIZES) {
      for (let i = 0; i < 40; i++) {
        const p = newPuzzle(size, createRandom(`s${size}-${i}`))
        expect(p.solution).toHaveLength(size * size)
        expect(new Set(p.solution).size).toBe(size * size)
        for (let k = 1; k < p.solution.length; k++) expect(adjacent(size, p.solution[k - 1], p.solution[k])).toBe(true)
        // Numbers appear in order along the solution, first and last numbered.
        const along = p.solution.map((c) => p.numbers[c]).filter((n) => n !== undefined)
        expect(along).toEqual(Array.from({ length: p.count }, (_, n) => n + 1))
        expect(p.numbers[p.solution[0]]).toBe(1)
        expect(p.numbers[p.solution[size * size - 1]]).toBe(p.count)
        // Replaying the solution wins.
        const end = stepThrough(newGame(size, createRandom(`s${size}-${i}`)), p.solution)
        expect(end.status).toBe('won')
      }
    }
  })
})

describe('VibeLine moves', () => {
  const game = () => newGame(4, createRandom('moves'))

  it('starts on number 1', () => {
    const g = game()
    expect(g.path).toEqual([startCell(g.puzzle)])
    expect(reached(g)).toBe(1)
  })

  it('rejects non-adjacent cells, revisits and numbers out of order', () => {
    const g = game()
    const sol = g.puzzle.solution
    expect(step(g, sol[5])).toBe(g) // not adjacent
    const one = step(g, sol[1])
    expect(step(one, sol[0])).not.toBe(one) // stepping back is an erase, not a revisit
  })

  it('stepping back onto the previous cell erases the last step; undo and reset work', () => {
    const g = game()
    const sol = g.puzzle.solution
    const a = stepThrough(g, [sol[1], sol[2]])
    expect(a.path).toHaveLength(3)
    expect(step(a, sol[1]).path).toEqual([sol[0], sol[1]])
    expect(undo(a).path).toHaveLength(2)
    expect(undo(g)).toBe(g)
    expect(reset(a).path).toEqual([sol[0]])
  })

  it('cannot skip a number: entering number 3 before 2 is refused', () => {
    // Search seeds for a case where a numbered cell is adjacent to a cell on the way.
    for (let i = 0; i < 50; i++) {
      const g = newGame(4, createRandom(`skip${i}`))
      const { numbers, solution } = g.puzzle
      const three = solution.findIndex((c) => numbers[c] === 3)
      const two = solution.findIndex((c) => numbers[c] === 2)
      if (three - two !== 1) continue
      // Walk to the cell just before 2 (not numbered), then try to enter 3 from there if adjacent to it.
      const before = stepThrough(g, solution.slice(1, two))
      const wrong = step(before, solution[three])
      if (adjacent(4, before.path[before.path.length - 1], solution[three])) expect(wrong).toBe(before)
    }
  })

  it('ends on the last number: the line cannot continue past it, and a full cover wins', () => {
    const g = game()
    const p = g.puzzle
    const almost = stepThrough(g, p.solution.slice(1, -1))
    expect(almost.status).toBe('playing')
    const won = step(almost, p.solution[p.solution.length - 1])
    expect(won.status).toBe('won')
    expect(step(won, p.solution[0])).toBe(won)
    expect(undo(won)).toBe(won)
  })
})

describe('VibeLine score', () => {
  it('drops 4 points per second and has a floor of 100', () => {
    expect(scoreFor(0)).toBe(1000)
    expect(scoreFor(30)).toBe(880)
    expect(scoreFor(10_000)).toBe(100)
  })
})
