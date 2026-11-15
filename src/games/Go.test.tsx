import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRandom } from '../lib/rng'
import { Go } from './Go'
import { aiChoose, isOver, newGame, pass, play } from './go/rules'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const THINK = 450

function setup(seed = 'go-component') {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <Go onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const point = (i: number) => view.container.querySelector<HTMLButtonElement>(`[data-pt="${i}"]`)!
  const cells = () => Array.from(view.container.querySelectorAll<HTMLElement>('[data-pt]')).map((el) => Number(el.dataset.p ?? 0))
  return { onFinish, point, cells }
}

describe('Go component', () => {
  it('placing a stone makes the computer answer once, like the pure model', () => {
    const { point, cells } = setup()
    fireEvent.click(point(40))
    expect(screen.getByText('Computer is thinking…')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(THINK))
    const after = play(newGame(9), 40)
    const ai = aiChoose(after, createRandom('go-component:0'), 'normal')
    const expected = ai === 'pass' ? pass(after) : play(after, ai)
    expect(cells()).toEqual(expected.cells)
    expect(screen.getByText('Your move (black)')).toBeInTheDocument()
  })

  it('passing at the start ends the game (the computer passes back, ahead on komi) and reports once', () => {
    const { onFinish } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Pass' }))
    act(() => void vi.advanceTimersByTime(THINK))
    expect(screen.getByRole('heading', { name: /Computer wins by 6.5/ })).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(5000))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: false })
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
  })

  it('a played-out game ends and reports exactly once in StrictMode', () => {
    const { point, onFinish } = setup('go-once')
    let model = newGame(9)
    const ai = createRandom('go-once:0')
    for (let g = 0; g < 400 && !isOver(model); g++) {
      if (model.turn === 1) {
        // The human just takes the first free point in reading order, then passes once most of the board is settled.
        const free = model.cells.findIndex((c, i) => c === 0 && play(model, i) !== model)
        if (g > 40 || free < 0) {
          fireEvent.click(screen.getByRole('button', { name: 'Pass' }))
          model = pass(model)
        } else {
          fireEvent.click(point(free))
          model = play(model, free)
        }
      } else {
        const c = aiChoose(model, ai, 'normal')
        act(() => void vi.advanceTimersByTime(THINK))
        model = c === 'pass' ? pass(model) : play(model, c)
      }
    }
    expect(isOver(model)).toBe(true)
    act(() => void vi.advanceTimersByTime(5000))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('switching to 13x13 deals a 169-point board, and points are buttons with coordinates', () => {
    const { point } = setup()
    expect(point(0)).toHaveAccessibleName('A9, empty')
    fireEvent.change(screen.getByLabelText('Board size'), { target: { value: '13' } })
    expect(document.querySelectorAll('[data-pt]')).toHaveLength(169)
  })

  it('P passes from the keyboard', () => {
    const { point } = setup()
    fireEvent.keyDown(window, { key: 'p' })
    act(() => void vi.advanceTimersByTime(THINK))
    expect(screen.getByRole('heading', { name: /wins by/ })).toBeInTheDocument()
    expect(point(0)).toBeDisabled()
  })
})
