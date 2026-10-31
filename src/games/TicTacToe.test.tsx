import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRandom } from '../lib/rng'
import { TicTacToe } from './TicTacToe'
import { aiMove, isOver, legalCells, newGame, play } from './tictactoe/rules'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const THINK = 400

function setup(seed = 'ttt-component') {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <TicTacToe onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const cell = (i: number) => view.container.querySelector<HTMLButtonElement>(`[data-cell="${i}"]`)!
  const marks = () => Array.from(view.container.querySelectorAll('.ttt-cell')).map((el) => Number(el.getAttribute('data-p')))
  const turn = (i: number) => {
    fireEvent.click(cell(i))
    act(() => void vi.advanceTimersByTime(THINK))
  }
  return { onFinish, cell, marks, turn }
}

describe('Tic-Tac-Toe component', () => {
  it('the computer answers once, after a pause, matching the pure model', () => {
    const { cell, marks } = setup()
    fireEvent.click(cell(4))
    expect(screen.getByText('Computer is thinking…')).toBeInTheDocument()
    expect(marks().filter((p) => p === 2)).toHaveLength(0)
    act(() => void vi.advanceTimersByTime(THINK))
    const random = createRandom('ttt-component')
    const s = play(play(newGame(), 4), aiMove(play(newGame(), 4), random))
    expect(marks()).toEqual(s.cells)
    act(() => void vi.advanceTimersByTime(5000))
    expect(marks().filter((p) => p === 2)).toHaveLength(1)
  })

  it('ignores clicks while the computer thinks and on taken squares; number keys work', () => {
    const { cell, marks } = setup()
    fireEvent.keyDown(window, { key: '5' })
    fireEvent.click(cell(0))
    expect(marks().filter((p) => p === 1)).toHaveLength(1)
    expect(marks()[4]).toBe(1)
  })

  it('reports a finished game exactly once and "Play again" starts clean', () => {
    const { onFinish, cell, turn } = setup()
    let guard = 0
    while (!onFinish.mock.calls.length && guard++ < 9) {
      const free = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((i) => !cell(i).disabled)!
      turn(free)
    }
    expect(onFinish).toHaveBeenCalledTimes(1)
    const result = onFinish.mock.calls[0][0]
    expect(result.stats.moves).toBeGreaterThanOrEqual(5)
    expect(typeof result.won).toBe('boolean')
    act(() => void vi.advanceTimersByTime(10_000))
    expect(onFinish).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(screen.getByText('Your move')).toBeInTheDocument()
  })

  it('does not report an abandoned game', () => {
    const { onFinish, turn } = setup()
    turn(4)
    fireEvent.click(screen.getByRole('button', { name: /New/ }))
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('model sanity: a finished model game has no legal cells', () => {
    let s = newGame()
    const r = createRandom('m')
    while (!isOver(s)) s = play(s, aiMove(s, r))
    expect(legalCells(s)).toEqual([])
  })
})
