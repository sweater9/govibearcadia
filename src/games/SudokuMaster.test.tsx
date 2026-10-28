import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRandom } from '../lib/rng'
import { SudokuMaster } from './SudokuMaster'
import { CLUES, newGame, scoreFor } from './sudoku/rules'

// Under StrictMode a solved puzzle must be reported once. The component deals from the same seeded
// stream as the model here, so the exact puzzle and its solution are known.

beforeEach(() => vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] }))
afterEach(() => vi.useRealTimers())

const SEED = 'sdk-component'
const model = () => newGame(createRandom(SEED), 'medium')

function setup() {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <SudokuMaster onFinish={onFinish} seed={SEED} />
    </StrictMode>,
  )
  const cell = (i: number) => view.container.querySelector<HTMLButtonElement>(`[data-i="${i}"]`)!
  const key = (k: string) => fireEvent.keyDown(window, { key: k })
  const pick = (i: number) => fireEvent.click(cell(i))
  return { onFinish, view, cell, key, pick }
}

describe('Sudoku Master component', () => {
  it('deals the seeded puzzle with its givens locked', () => {
    const { cell } = setup()
    const m = model()
    m.puzzle.forEach((v, i) => {
      expect(cell(i).getAttribute('data-v')).toBe(v ? String(v) : null)
      expect(cell(i).hasAttribute('data-given')).toBe(v !== 0)
    })
    expect(m.puzzle.filter(Boolean).length).toBeGreaterThanOrEqual(CLUES.medium)
  })

  it('places a digit in the selected cell, and ignores givens', () => {
    const { cell, key, pick } = setup()
    const m = model()
    const empty = m.puzzle.findIndex((v) => v === 0)
    const given = m.puzzle.findIndex((v) => v !== 0)
    pick(empty)
    key(String(m.solution[empty]))
    expect(cell(empty).getAttribute('data-v')).toBe(String(m.solution[empty]))
    pick(given)
    key(m.puzzle[given] === 9 ? '1' : '9')
    expect(cell(given).getAttribute('data-v')).toBe(String(m.puzzle[given]))
  })

  it('a wrong digit counts as a mistake and is flagged when it clashes', () => {
    const { cell, key, pick } = setup()
    const m = model()
    // Put, in an empty cell, a digit that its own row already holds as a given: a visible clash.
    const empty = m.puzzle.findIndex((v) => v === 0)
    const row = Math.floor(empty / 9)
    const clash = m.puzzle[row * 9 + [0, 1, 2, 3, 4, 5, 6, 7, 8].find((c) => m.puzzle[row * 9 + c] !== 0)!]
    pick(empty)
    key(String(clash))
    expect(cell(empty).hasAttribute('data-conflict')).toBe(true)
    expect(screen.getByLabelText('Mistakes 1')).toBeInTheDocument()
  })

  it('notes mode (N or the pencil button) writes pencil marks instead of digits', () => {
    const { cell, key, pick } = setup()
    const empty = model().puzzle.findIndex((v) => v === 0)
    pick(empty)
    key('n')
    expect(screen.getByRole('button', { name: 'Pencil notes' })).toHaveAttribute('aria-pressed', 'true')
    key('3')
    key('7')
    expect(cell(empty).getAttribute('data-v')).toBeNull()
    expect(cell(empty).getAttribute('aria-label')).toContain('notes 3 7')
    key('3') // toggles off
    expect(cell(empty).getAttribute('aria-label')).toContain('notes 7')
    fireEvent.click(screen.getByRole('button', { name: 'Pencil notes' }))
    expect(screen.getByRole('button', { name: 'Pencil notes' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('erase, Backspace and the number pad work', () => {
    const { cell, key, pick } = setup()
    const m = model()
    const empty = m.puzzle.findIndex((v) => v === 0)
    pick(empty)
    fireEvent.click(screen.getByRole('button', { name: `Enter ${m.solution[empty]}` }))
    expect(cell(empty).getAttribute('data-v')).toBe(String(m.solution[empty]))
    fireEvent.click(screen.getByRole('button', { name: 'Erase' }))
    expect(cell(empty).getAttribute('data-v')).toBeNull()
    key(String(m.solution[empty]))
    key('Backspace')
    expect(cell(empty).getAttribute('data-v')).toBeNull()
  })

  it('arrow keys move the selection', () => {
    const { cell, key, pick } = setup()
    pick(0)
    key('ArrowRight')
    key('ArrowDown')
    expect(cell(10).hasAttribute('data-selected')).toBe(true)
    key('ArrowUp')
    key('ArrowLeft')
    key('ArrowLeft') // stops at the edge
    expect(cell(0).hasAttribute('data-selected')).toBe(true)
  })

  it('reports a solved puzzle exactly once, with the time and mistakes in the score', () => {
    const { onFinish, key, pick } = setup()
    const m = model()
    const empties = m.puzzle.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0)
    // one deliberate mistake first
    pick(empties[0])
    key(String(m.solution[empties[0]] === 1 ? 2 : 1))
    act(() => void vi.advanceTimersByTime(90_000))
    for (const i of empties) {
      pick(i)
      key(String(m.solution[i]))
    }
    expect(screen.getByText('Solved!')).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    const result = onFinish.mock.calls[0][0]
    expect(result).toMatchObject({ won: true, stats: { mistakes: 1, difficulty: 2 } })
    expect(result.score).toBe(scoreFor({ ...m, mistakes: 1 }, 90))
    act(() => void vi.advanceTimersByTime(10_000))
    key('5')
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('changing the difficulty deals a different puzzle without recording anything', () => {
    const { onFinish, view } = setup()
    const givens = () => view.container.querySelectorAll('[data-given]').length
    const medium = givens()
    const level = screen.getByLabelText('Difficulty')
    fireEvent.change(level, { target: { value: 'easy' } })
    expect(givens()).toBeGreaterThan(medium)
    expect(level).toHaveValue('easy')
    fireEvent.change(level, { target: { value: 'hard' } })
    expect(givens()).toBeLessThan(medium)
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('shows the elapsed time once play starts', () => {
    const { key, pick } = setup()
    const m = model()
    const empty = m.puzzle.findIndex((v) => v === 0)
    pick(empty)
    key(String(m.solution[empty]))
    act(() => void vi.advanceTimersByTime(75_000))
    expect(screen.getByText('1:15')).toBeInTheDocument()
  })
})
