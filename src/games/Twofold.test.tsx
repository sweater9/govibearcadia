import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Twofold } from './Twofold'
import { createRandom } from '../lib/rng'
import { conflicts, newGame, type Mark } from './twofold/rules'

const SEED = 'tf-component'

function setup() {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <Twofold onFinish={onFinish} seed={SEED} />
    </StrictMode>,
  )
  const model = newGame(6, createRandom(SEED))
  const cell = (i: number) => view.container.querySelector<HTMLElement>(`[data-cell="${i}"]`)!
  return { onFinish, view, model, cell }
}

describe('Twofold component', () => {
  it('shows the fixed cells and cycles a free one', () => {
    const { model, cell } = setup()
    const free = model.cells.indexOf(-1)
    expect(cell(free)).toHaveTextContent('')
    fireEvent.click(cell(free))
    expect(cell(free)).toHaveTextContent('☀')
    fireEvent.click(cell(free))
    expect(cell(free)).toHaveTextContent('☾')
    fireEvent.click(cell(free))
    expect(cell(free)).toHaveTextContent('')
    const given = model.cells.findIndex((v) => v !== -1)
    const before = cell(given).textContent
    fireEvent.click(cell(given))
    expect(cell(given).textContent).toBe(before)
  })

  it('marks a move that breaks a rule, and clears the mark when it is taken back', () => {
    const { model, cell } = setup()
    const move = model.cells
      .flatMap((v, i) => (v === -1 ? [[i, 0], [i, 1]] : []))
      .find(([i, v]) => {
        const next = [...model.cells]
        next[i] = v as Mark
        return conflicts(6, next).has(i)
      })!
    const [i, v] = move
    for (let k = 0; k <= v; k++) fireEvent.click(cell(i))
    expect(cell(i).getAttribute('aria-label')).toMatch(/breaks a rule/)
    fireEvent.click(cell(i + 0))
    fireEvent.click(cell(i))
    expect(cell(i).getAttribute('aria-label')).not.toMatch(/breaks a rule/)
  })

  it('reports a solved grid exactly once under StrictMode', () => {
    const { onFinish, model, cell } = setup()
    for (const [i, v] of model.cells.entries()) {
      if (v !== -1) continue
      for (let k = 0; k <= model.puzzle.solution[i]; k++) fireEvent.click(cell(i))
    }
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ won: true, stats: { size: 6 } }))
    expect(screen.getByText(/Solved in/)).toBeInTheDocument()
    fireEvent.click(cell(model.cells.indexOf(-1)))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('changing size deals a new board without reporting', () => {
    const { onFinish, view } = setup()
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: '4' } })
    expect(view.container.querySelectorAll('[data-cell]')).toHaveLength(16)
    expect(onFinish).not.toHaveBeenCalled()
  })
})
