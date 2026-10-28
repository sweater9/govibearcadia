import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createRandom } from '../lib/rng'
import { Minesweeper } from './Minesweeper'
import { newGame, reveal, scoreFor, type MinesState } from './minesweeper/rules'

// These run under StrictMode, which double-invokes updaters and effects in development. They guard
// the "report each run exactly once" rule, and play real games against the exact seeded layout the
// component deals (the component and this test draw from identical random streams).

const SEED = 'ms-component'

function setup(seed = SEED) {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <Minesweeper onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const cell = (r: number, c: number) => view.container.querySelector<HTMLButtonElement>(`[data-r="${r}"][data-c="${c}"]`)!
  return { onFinish, cell, view }
}

const cellsOf = (state: MinesState) => state.cells.flatMap((row, r) => row.map((c, col) => ({ r, c: col, cell: c })))

/** The layout the component will deal for its first game, after the first click at (4, 4). */
const firstGame = (random = createRandom(SEED)) => reveal(newGame(), 4, 4, random)

describe('Minesweeper component', () => {
  it('reports a cleared board exactly once, with the right result', () => {
    const { onFinish, cell } = setup()
    fireEvent.click(cell(4, 4))
    const model = firstGame()
    for (const { r, c, cell: m } of cellsOf(model)) if (!m.mine && m.state === 'hidden') fireEvent.click(cell(r, c))

    expect(screen.getByText(/Field cleared!/)).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    const result = onFinish.mock.calls[0][0]
    expect(result).toMatchObject({ won: true, stats: { opened: 71, mines: 10 } })
    expect(result.score).toBeGreaterThanOrEqual(710 + 200)
  })

  it('reports a lost game once, ignores further clicks, and reports a second game separately', () => {
    const { onFinish, cell } = setup()
    const random = createRandom(SEED)
    const hitMine = (model: MinesState) => cellsOf(model).find((x) => x.cell.mine)!

    fireEvent.click(cell(4, 4))
    const first = firstGame(random)
    const mine = hitMine(first)
    fireEvent.click(cell(mine.r, mine.c))

    expect(screen.getByText(/Boom!/)).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: false, score: first.opened * 10 })
    expect(cell(mine.r, mine.c).className).toContain('boom')

    fireEvent.click(cell(0, 0)) // game is over: nothing happens
    fireEvent.contextMenu(cell(0, 1))
    expect(onFinish).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    fireEvent.click(cell(4, 4))
    const second = reveal(newGame(), 4, 4, random) // the same random stream continues across games
    const secondMine = hitMine(second)
    fireEvent.click(cell(secondMine.r, secondMine.c))
    expect(onFinish).toHaveBeenCalledTimes(2)
  })

  it('does not record a board that was abandoned', () => {
    const { onFinish, cell } = setup()
    fireEvent.click(cell(4, 4))
    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    expect(onFinish).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: /hidden$/ })).toHaveLength(81)
  })

  it('computes the same score the rules module does', () => {
    const { onFinish, cell } = setup()
    fireEvent.click(cell(4, 4))
    const model = firstGame()
    const mine = cellsOf(model).find((x) => x.cell.mine)!
    fireEvent.click(cell(mine.r, mine.c))
    const lost = reveal(model, mine.r, mine.c)
    expect(onFinish.mock.calls[0][0].score).toBe(scoreFor(lost, 0))
  })

  it('flags with right-click, counts mines left, and never opens a flagged cell', () => {
    const { cell } = setup()
    expect(screen.getByText('Mines').nextSibling).toHaveTextContent('10')
    fireEvent.contextMenu(cell(0, 0))
    expect(cell(0, 0)).toHaveAttribute('aria-label', 'Row 1, column 1: flagged')
    expect(screen.getByText('Mines').nextSibling).toHaveTextContent('9')

    fireEvent.click(cell(0, 0))
    expect(cell(0, 0)).toHaveAttribute('aria-label', 'Row 1, column 1: flagged')

    fireEvent.contextMenu(cell(0, 0))
    expect(cell(0, 0)).toHaveAttribute('aria-label', 'Row 1, column 1: hidden')
  })

  it('flag mode turns taps into flags', () => {
    const { onFinish, cell } = setup()
    const toggle = screen.getByRole('button', { name: /Flag mode/ })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(cell(2, 2))
    expect(cell(2, 2)).toHaveAttribute('aria-label', 'Row 3, column 3: flagged')
    fireEvent.click(cell(2, 2))
    expect(cell(2, 2)).toHaveAttribute('aria-label', 'Row 3, column 3: hidden')
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('moves focus with the arrow keys and flags with F', () => {
    const { cell } = setup()
    cell(0, 0).focus()
    fireEvent.keyDown(cell(0, 0), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(cell(0, 1))
    fireEvent.keyDown(cell(0, 1), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(cell(1, 1))
    fireEvent.keyDown(cell(1, 1), { key: 'ArrowUp' })
    fireEvent.keyDown(cell(0, 1), { key: 'ArrowUp' }) // edge: stays put
    expect(document.activeElement).toBe(cell(0, 1))

    fireEvent.keyDown(cell(0, 1), { key: 'f' })
    expect(cell(0, 1)).toHaveAttribute('aria-label', 'Row 1, column 2: flagged')
  })

  it('keeps exactly one cell in the tab order', () => {
    const { view } = setup()
    expect(view.container.querySelectorAll('.mine-cell[tabindex="0"]')).toHaveLength(1)
  })
})
