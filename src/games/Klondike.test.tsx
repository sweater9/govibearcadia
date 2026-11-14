import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { State } from './klondike/rules'
import { Klondike } from './Klondike'

// A deal one move from won: the king of spades is the only card left, face up in the first column.
const almostWon: State = {
  tableau: [{ down: [], up: [12] }, ...Array.from({ length: 6 }, () => ({ down: [], up: [] as number[] }))],
  stock: [],
  waste: [],
  foundations: [Array.from({ length: 12 }, (_, i) => i), Array.from({ length: 13 }, (_, i) => 13 + i), Array.from({ length: 13 }, (_, i) => 26 + i), Array.from({ length: 13 }, (_, i) => 39 + i)],
  draw: 1,
  moves: 40,
  points: 300,
  recycles: 0,
}

vi.mock('./klondike/rules', async (importOriginal) => ({ ...(await importOriginal<typeof import('./klondike/rules')>()), newGame: () => almostWon }))

describe('Klondike', () => {
  it('reports a finished run exactly once under StrictMode', () => {
    const onFinish = vi.fn()
    render(<StrictMode><Klondike onFinish={onFinish} seed="x" /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'King of spades' }))
    fireEvent.click(screen.getByRole('button', { name: 'King of spades' }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true, stats: { moves: 41 } })
    expect(screen.getByText('You won!')).toBeInTheDocument()
  })

  it('moves a card by tapping it and then its pile', () => {
    const onFinish = vi.fn()
    render(<Klondike onFinish={onFinish} seed="x" />)
    fireEvent.click(screen.getByRole('button', { name: 'King of spades' }))
    fireEvent.click(screen.getByRole('button', { name: /^Spades foundation/ }))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('does not finish when a card is only selected', () => {
    const onFinish = vi.fn()
    render(<Klondike onFinish={onFinish} seed="x" />)
    fireEvent.click(screen.getByRole('button', { name: 'King of spades' }))
    expect(onFinish).not.toHaveBeenCalled()
  })
})
