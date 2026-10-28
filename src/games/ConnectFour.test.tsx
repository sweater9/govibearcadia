import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRandom } from '../lib/rng'
import { ConnectFour } from './ConnectFour'
import { aiMove, drop, isOver, newGame, type C4State } from './connect4/rules'

// Under StrictMode the computer must answer exactly once per human move, drawing from the seeded
// stream once, and each finished game must be reported once.

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const SEED = 'c4-component'
const THINK = 450

function setup(seed = SEED) {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <ConnectFour onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const col = (c: number) => view.container.querySelector<HTMLButtonElement>(`[data-col="${c}"]`)!
  const cell = (r: number, c: number) => view.container.querySelector(`[data-r="${r}"][data-c="${c}"]`)!
  /** Human plays a column, then the computer's reply timer elapses. */
  const turn = (c: number) => {
    fireEvent.click(col(c))
    act(() => void vi.advanceTimersByTime(THINK))
  }
  return { onFinish, view, col, cell, turn }
}

/** The pure model of the same game: same moves, same random stream. */
function model(humanCols: number[], seed = SEED): C4State {
  const random = createRandom(seed)
  let s = newGame()
  for (const c of humanCols) {
    s = drop(s, c)
    if (!isOver(s)) s = drop(s, aiMove(s, random))
  }
  return s
}

const boardOf = (view: ReturnType<typeof setup>['view']) =>
  Array.from(view.container.querySelectorAll('.c4-cell')).map((el) => Number(el.getAttribute('data-p')))

describe('Connect Four component', () => {
  it('lets the human move, then the computer answers once after a pause', () => {
    const { view, col } = setup()
    fireEvent.click(col(3))
    expect(screen.getByText('Computer is thinking…')).toBeInTheDocument()
    expect(boardOf(view).filter((p) => p === 2)).toHaveLength(0)
    act(() => void vi.advanceTimersByTime(THINK - 1))
    expect(boardOf(view).filter((p) => p === 2)).toHaveLength(0)
    act(() => void vi.advanceTimersByTime(1))
    expect(boardOf(view).filter((p) => p === 2)).toHaveLength(1)
    expect(screen.getByText('Your move')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(5000)) // and it does not move again on its own
    expect(boardOf(view).filter((p) => p === 2)).toHaveLength(1)
  })

  it('ignores clicks while the computer thinks', () => {
    const { view, col } = setup()
    fireEvent.click(col(3))
    fireEvent.click(col(4))
    expect(boardOf(view).filter((p) => p === 1)).toHaveLength(1)
  })

  it('matches the pure model move for move, under the seeded stream', () => {
    const moves = [3, 3, 4, 2]
    const { view, turn } = setup()
    moves.forEach((c, i) => {
      turn(c)
      expect(boardOf(view)).toEqual(model(moves.slice(0, i + 1)).cells)
    })
  })

  it('accepts the number keys', () => {
    const { view } = setup()
    fireEvent.keyDown(window, { key: '4' })
    expect(boardOf(view)[5 * 7 + 3]).toBe(1)
  })

  it('reports a finished game exactly once and "New" starts clean', () => {
    // Play human moves in column 0..3 along the bottom row until the game ends one way or the other.
    const { onFinish, turn } = setup()
    let guard = 0
    while (!onFinish.mock.calls.length && guard++ < 21) {
      for (const c of [0, 1, 2, 3, 4, 5, 6]) {
        if (onFinish.mock.calls.length) break
        const btn = document.querySelector<HTMLButtonElement>(`[data-col="${c}"]`)!
        if (!btn.disabled) {
          turn(c)
          break
        }
      }
    }
    expect(onFinish).toHaveBeenCalledTimes(1)
    const result = onFinish.mock.calls[0][0]
    expect(result.stats.moves).toBeGreaterThan(3)
    act(() => void vi.advanceTimersByTime(10_000))
    expect(onFinish).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(screen.getByText('Your move')).toBeInTheDocument()
  })

  it('does not report an abandoned game', () => {
    const { onFinish, turn } = setup()
    turn(3)
    fireEvent.click(screen.getByRole('button', { name: /New/ }))
    expect(onFinish).not.toHaveBeenCalled()
  })
})
