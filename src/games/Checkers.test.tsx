import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRandom } from '../lib/rng'
import { Checkers } from './Checkers'
import { aiStep, legalSteps, newGame, sq, step } from './checkers/rules'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const THINK = 500

function setup(seed = 'ck-component') {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <Checkers onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const square = (i: number) => view.container.querySelector<HTMLButtonElement>(`[data-sq="${i}"]`)!
  const cells = () => {
    const out = Array<number>(64).fill(0)
    view.container.querySelectorAll<HTMLElement>('[data-sq]').forEach((el) => {
      const piece = el.querySelector('.ck-piece')
      if (piece) out[Number(el.dataset.sq)] = Number(piece.getAttribute('data-p')) + (piece.hasAttribute('data-king') ? 2 : 0)
    })
    return out
  }
  return { onFinish, square, cells }
}

describe('Checkers component', () => {
  it('selecting a piece highlights its moves; moving it makes the computer answer once, like the pure model', () => {
    const { square, cells } = setup()
    fireEvent.click(square(sq(5, 0)))
    expect(square(sq(5, 0)).dataset.sel).toBe('true')
    expect(square(sq(4, 1)).dataset.target).toBe('true')
    fireEvent.click(square(sq(4, 1)))
    expect(screen.getByText('Computer is thinking…')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(THINK))
    const after = step(newGame(), sq(5, 0), sq(4, 1))
    const reply = aiStep(after, createRandom('ck-component'))!
    expect(cells()).toEqual(step(after, reply.from, reply.to).cells)
    act(() => void vi.advanceTimersByTime(5000))
    expect(cells()).toEqual(step(after, reply.from, reply.to).cells)
  })

  it('does nothing when a piece that cannot move is clicked, and Escape drops the pick', () => {
    const { square } = setup()
    fireEvent.click(square(sq(7, 0)))
    expect(square(sq(7, 0)).dataset.sel).toBeUndefined()
    fireEvent.click(square(sq(5, 2)))
    expect(square(sq(5, 2)).dataset.sel).toBe('true')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(square(sq(5, 2)).dataset.sel).toBeUndefined()
  })

  it('plays whole games and reports each finished game exactly once', () => {
    const { onFinish, square } = setup()
    // Always take the first legal step; the computer answers after each pause.
    let guard = 0
    let model = newGame()
    const random = createRandom('ck-component')
    while (!onFinish.mock.calls.length && guard++ < 600) {
      if (model.turn === 1) {
        const m = legalSteps(model)[0]
        fireEvent.click(square(m.from))
        fireEvent.click(square(m.to))
        model = step(model, m.from, m.to)
      } else {
        const m = aiStep(model, random)!
        act(() => void vi.advanceTimersByTime(THINK))
        model = step(model, m.from, m.to)
      }
    }
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].stats.moves).toBe(model.moves)
    act(() => void vi.advanceTimersByTime(10_000))
    expect(onFinish).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(screen.getByText('Your move')).toBeInTheDocument()
  })

  it('does not report an abandoned game', () => {
    const { onFinish, square } = setup()
    fireEvent.click(square(sq(5, 0)))
    fireEvent.click(square(sq(4, 1)))
    fireEvent.click(screen.getByRole('button', { name: /New/ }))
    expect(onFinish).not.toHaveBeenCalled()
  })
})
