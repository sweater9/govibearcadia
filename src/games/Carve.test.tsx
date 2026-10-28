import { StrictMode } from 'react'
import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Carve } from './Carve'
import { createRandom } from '../lib/rng'
import { cellsOf, newGame } from './carve/rules'

const SEED = 'cv-component'

function setup() {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <Carve onFinish={onFinish} seed={SEED} />
    </StrictMode>,
  )
  const model = newGame(5, createRandom(SEED))
  const board = screen.getByRole('group', { name: /Carve 5 by 5/ })
  const cell = (i: number) => view.container.querySelector<HTMLElement>(`[data-cell="${i}"]`)!
  // jsdom has no layout, so point elementFromPoint at the cell we mean.
  const at = (i: number) => {
    document.elementFromPoint = () => cell(i)
    return i
  }
  const pointer = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', i: number) => {
    at(i)
    const e = createEvent[type](board)
    Object.defineProperty(e, 'clientX', { value: 1 })
    Object.defineProperty(e, 'clientY', { value: 1 })
    fireEvent(board, e)
  }
  const carve = (from: number, to: number) => {
    pointer('pointerDown', from)
    pointer('pointerMove', to)
    pointer('pointerUp', to)
  }
  const pieces = () => view.container.querySelectorAll('[data-piece]').length
  return { onFinish, model, carve, pieces, view }
}

describe('Carve component', () => {
  it('starts empty and shows the numbers', () => {
    const { model, pieces, view } = setup()
    expect(pieces()).toBe(0)
    const nums = [...view.container.querySelectorAll('.cv-cell')].filter((el) => el.textContent).length
    expect(nums).toBe(model.puzzle.solution.length)
  })

  it('drags out a rectangle and taps it away', () => {
    const { carve, pieces } = setup()
    carve(0, 6)
    expect(pieces()).toBe(4)
    carve(0, 0) // tap on a piece removes it
    expect(pieces()).toBe(0)
  })

  it('reports a solved grid exactly once under StrictMode', () => {
    const { onFinish, model, carve } = setup()
    for (const r of model.puzzle.solution) {
      const cells = cellsOf(r, 5)
      carve(cells[0], cells[cells.length - 1])
    }
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ won: true, stats: { size: 5, pieces: model.puzzle.solution.length } }))
    expect(screen.getByText(/Carved in/)).toBeInTheDocument()
    carve(0, 0)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('resizing deals a new board without reporting', () => {
    const { onFinish, view } = setup()
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: '7' } })
    expect(view.container.querySelectorAll('[data-cell]')).toHaveLength(49)
    expect(onFinish).not.toHaveBeenCalled()
  })
})
