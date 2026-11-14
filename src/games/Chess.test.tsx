import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { squareOf, type Move } from './chess/rules'
import { Chess } from './Chess'

// The computer plays White's half of fool's mate: 1. f3 and 2. g4, so Black can mate with ...Qh4.
const script: Move[] = [{ from: squareOf('f2'), to: squareOf('f3') }, { from: squareOf('g2'), to: squareOf('g4') }]
vi.mock('./chess/ai', async (importOriginal) => {
  const real = await importOriginal<typeof import('./chess/ai')>()
  let n = 0
  return { ...real, chooseMove: () => script[n++ % script.length] }
})

const sq = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name},`) })

describe('Chess', () => {
  it('reports a win exactly once under StrictMode', async () => {
    const onFinish = vi.fn()
    render(<StrictMode><Chess onFinish={onFinish} seed="x" /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Play Black' }))
    await waitFor(() => expect(sq('f3')).toHaveAccessibleName(/white pawn/))
    fireEvent.click(sq('e7')); fireEvent.click(sq('e5'))
    await waitFor(() => expect(sq('g4')).toHaveAccessibleName(/white pawn/))
    fireEvent.click(sq('d8')); fireEvent.click(sq('h4'))
    await waitFor(() => expect(screen.getByText('You win!')).toBeInTheDocument())
    await new Promise((r) => setTimeout(r, 450))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true })
  })
  it('shows only legal moves for a selected piece and ignores a click on an empty square', () => {
    render(<Chess onFinish={() => {}} seed="x" />)
    fireEvent.click(screen.getByRole('button', { name: 'Play White' }))
    fireEvent.click(sq('e2'))
    expect(sq('e4').getAttribute('data-target')).toBe('move')
    expect(sq('e5').getAttribute('data-target')).toBeNull()
    fireEvent.click(sq('e5'))
    expect(sq('e2').getAttribute('data-picked')).toBeNull()
  })
  it('resigning ends the game as a loss, once', () => {
    const onFinish = vi.fn()
    render(<Chess onFinish={onFinish} seed="x" />)
    fireEvent.click(screen.getByRole('button', { name: 'Play White' }))
    fireEvent.click(screen.getByRole('button', { name: 'Resign' }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: false, score: 0 })
  })
})
