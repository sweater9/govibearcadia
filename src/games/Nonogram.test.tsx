import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { newPuzzle } from './nonogram/rules'
import { Nonogram } from './Nonogram'

const SEED = 'unit'
const puzzle = newPuzzle(`${SEED}:5`, 5)
const cell = (r: number, c: number) => screen.getByRole('button', { name: new RegExp(`^Row ${r + 1}, column ${c + 1}:`) })

describe('Nonogram', () => {
  it('finishes exactly once under StrictMode when the picture is filled in', () => {
    const onFinish = vi.fn()
    render(<StrictMode><Nonogram onFinish={onFinish} seed={SEED} /></StrictMode>)
    puzzle.solution.forEach((row, r) => row.forEach((on, c) => { if (on) fireEvent.pointerDown(cell(r, c)) }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true, stats: { size: 5 } })
    expect(screen.getByText('Picture complete!')).toBeInTheDocument()
  })
  it('does not finish on a wrong picture, and a second tap clears a cell', () => {
    const onFinish = vi.fn()
    render(<Nonogram onFinish={onFinish} seed={SEED} />)
    fireEvent.pointerDown(cell(0, 0))
    expect(cell(0, 0)).toHaveAccessibleName(/filled/)
    fireEvent.pointerDown(cell(0, 0))
    expect(cell(0, 0)).toHaveAccessibleName(/blank/)
    expect(onFinish).not.toHaveBeenCalled()
  })
  it('keyboard Enter fills a cell and the mark tool marks it', () => {
    render(<Nonogram onFinish={() => {}} seed={SEED} />)
    fireEvent.keyDown(cell(1, 1), { key: 'Enter' })
    expect(cell(1, 1)).toHaveAccessibleName(/filled/)
    fireEvent.click(screen.getByRole('button', { name: 'Mark empty' }))
    fireEvent.pointerDown(cell(2, 2))
    expect(cell(2, 2)).toHaveAccessibleName(/marked empty/)
  })
})
