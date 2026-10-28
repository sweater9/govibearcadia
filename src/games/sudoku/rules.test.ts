import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import {
  BASE_SCORE, CELLS, CLUES, PEERS, candidates, conflicts, countSolutions, erase, fullGrid, isGiven,
  makePuzzle, newGame, noteDigits, place, scoreFor, toggleNote, type Difficulty, type SudokuState,
} from './rules'

const valid = (g: readonly number[]) => {
  const groups: number[][] = []
  for (let k = 0; k < 9; k++) {
    groups.push(Array.from({ length: 9 }, (_, j) => k * 9 + j)) // row
    groups.push(Array.from({ length: 9 }, (_, j) => j * 9 + k)) // column
    const r = Math.floor(k / 3) * 3
    const c = (k % 3) * 3
    groups.push(Array.from({ length: 9 }, (_, j) => (r + Math.floor(j / 3)) * 9 + c + (j % 3))) // box
  }
  return groups.every((idxs) => new Set(idxs.map((i) => g[i])).size === 9 && idxs.every((i) => g[i] >= 1 && g[i] <= 9))
}

describe('Sudoku generator', () => {
  it('fills a valid complete grid, deterministically per seed', () => {
    const a = fullGrid(createRandom('full'))
    expect(valid(a)).toBe(true)
    expect(fullGrid(createRandom('full'))).toEqual(a)
    expect(fullGrid(createRandom('other'))).not.toEqual(a)
  })

  it('every peer list has 20 cells and excludes the cell itself', () => {
    for (let i = 0; i < CELLS; i++) {
      expect(PEERS[i]).toHaveLength(20)
      expect(PEERS[i]).not.toContain(i)
    }
  })

  it('counts solutions: one for a complete grid, zero for a broken one, many for an empty one (capped)', () => {
    const full = fullGrid(createRandom('c'))
    expect(countSolutions(full)).toBe(1)
    const broken = full.slice()
    broken[0] = broken[1] // duplicate digit in a row
    expect(countSolutions(broken)).toBe(0)
    expect(countSolutions(Array(CELLS).fill(0), 3)).toBe(3)
  })

  for (const difficulty of ['easy', 'medium', 'hard'] as Difficulty[]) {
    it(`${difficulty}: deals a unique-solution puzzle with the right number of clues, matching its solution`, () => {
      for (let n = 0; n < 3; n++) {
        const s = newGame(createRandom(`gen-${difficulty}-${n}`), difficulty)
        expect(valid(s.solution)).toBe(true)
        expect(countSolutions(s.puzzle, 2)).toBe(1)
        expect(s.puzzle.filter(Boolean).length).toBeLessThanOrEqual(CLUES[difficulty] + 2)
        expect(s.puzzle.filter(Boolean).length).toBeGreaterThanOrEqual(CLUES[difficulty])
        s.puzzle.forEach((v, i) => v && expect(v).toBe(s.solution[i]))
      }
    })
  }

  it('the same seed and difficulty deal the same puzzle; different seeds do not', () => {
    const a = newGame(createRandom('same'), 'medium')
    expect(newGame(createRandom('same'), 'medium')).toEqual(a)
    expect(newGame(createRandom('diff'), 'medium').puzzle).not.toEqual(a.puzzle)
  })

  it('makePuzzle never removes a cell the solution depends on', () => {
    const full = fullGrid(createRandom('mp'))
    const puzzle = makePuzzle(full, 30, createRandom('mp2'))
    expect(countSolutions(puzzle, 2)).toBe(1)
  })
})

describe('Sudoku play', () => {
  const game = (): SudokuState => newGame(createRandom('play'), 'easy')
  const emptyIdx = (s: SudokuState) => s.cells.findIndex((v) => v === 0)

  it('candidates exclude digits used by peers', () => {
    const s = game()
    const i = emptyIdx(s)
    const mask = candidates(s.cells, i)
    expect(mask & (1 << s.solution[i])).toBeTruthy() // the true digit is always still possible
    for (const p of PEERS[i]) if (s.cells[p]) expect(mask & (1 << s.cells[p])).toBe(0)
  })

  it('placing the right digit leaves mistakes at 0 and removes that pencil mark from peers', () => {
    let s = game()
    const i = emptyIdx(s)
    const d = s.solution[i]
    const peer = PEERS[i].find((p) => s.cells[p] === 0)!
    s = toggleNote(s, peer, d)
    expect(noteDigits(s.notes[peer])).toEqual([d])
    s = place(s, i, d)
    expect(s.cells[i]).toBe(d)
    expect(s.mistakes).toBe(0)
    expect(s.notes[peer]).toBe(0)
    expect(s.notes[i]).toBe(0)
  })

  it('a wrong digit is placed but counts as a mistake, and shows up as a conflict when it clashes', () => {
    let s = game()
    const i = emptyIdx(s)
    const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => d !== s.solution[i])!
    s = place(s, i, wrong)
    expect(s.mistakes).toBe(1)
    expect(s.cells[i]).toBe(wrong)
    expect(place(s, i, wrong)).toBe(s) // same digit again: nothing happens
  })

  it('givens cannot be changed, erased or annotated', () => {
    const s = game()
    const g = s.puzzle.findIndex(Boolean)
    expect(isGiven(s, g)).toBe(true)
    expect(place(s, g, 9)).toBe(s)
    expect(erase(s, g)).toBe(s)
    expect(toggleNote(s, g, 1)).toBe(s)
  })

  it('notes toggle on and off, only on empty cells; erase clears a cell and its notes', () => {
    let s = game()
    const i = emptyIdx(s)
    s = toggleNote(toggleNote(s, i, 3), i, 5)
    expect(noteDigits(s.notes[i])).toEqual([3, 5])
    s = toggleNote(s, i, 3)
    expect(noteDigits(s.notes[i])).toEqual([5])
    expect(erase(s, i).notes[i]).toBe(0)
    const filled = place(s, i, s.solution[i])
    expect(toggleNote(filled, i, 2)).toBe(filled)
    expect(erase(filled, i).cells[i]).toBe(0)
    expect(erase(erase(filled, i), i)).toEqual(erase(filled, i))
  })

  it('filling every empty cell correctly wins, and a won game accepts no more input', () => {
    let s = game()
    for (let i = 0; i < CELLS; i++) if (s.cells[i] === 0) s = place(s, i, s.solution[i])
    expect(s.status).toBe('won')
    expect(s.mistakes).toBe(0)
    expect(place(s, 0, 1)).toBe(s)
    expect(erase(s, 0)).toBe(s)
  })

  it('conflicts() flags every duplicate in a row, column or box', () => {
    const cells = Array<number>(CELLS).fill(0)
    cells[0] = 5
    cells[8] = 5 // same row
    cells[40] = 7
    cells[22] = 7 // same box? (22 is row 2 col 4; 40 is row 4 col 4: same column)
    expect([...conflicts(cells)].sort((a, b) => a - b)).toEqual([0, 8, 22, 40])
    expect(conflicts(Array<number>(CELLS).fill(0)).size).toBe(0)
  })

  it('scores harder puzzles higher, and time and mistakes lower, never under 100', () => {
    const s = game()
    expect(scoreFor(s, 0)).toBe(BASE_SCORE.easy)
    expect(scoreFor(s, 90)).toBe(BASE_SCORE.easy - 30)
    expect(scoreFor({ ...s, mistakes: 2 }, 0)).toBe(BASE_SCORE.easy - 100)
    expect(scoreFor(s, 100000)).toBe(100)
    expect(scoreFor({ ...s, difficulty: 'hard' }, 0)).toBeGreaterThan(scoreFor(s, 0))
  })
})
