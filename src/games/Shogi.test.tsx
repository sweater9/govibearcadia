import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Shogi } from './Shogi'
import * as rules from './shogi/rules'

const { newGame } = rules

// A position one move from checkmate, so a whole game can be finished with two clicks.
vi.mock('./shogi/rules', async (orig) => {
  const real = await orig<typeof import('./shogi/rules')>()
  return { ...real, newGame: vi.fn(() => real.newGame()), __real: real }
})

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const sq = (row: number, col: number) => row * 9 + col

function setup(sfen?: string) {
  const real = (rules as unknown as { __real: typeof rules }).__real
  vi.mocked(newGame).mockImplementation(() => (sfen ? real.fromSfen(sfen) : real.newGame()))
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <Shogi onFinish={onFinish} seed="sg-component" />
    </StrictMode>,
  )
  const square = (i: number) => view.container.querySelector<HTMLButtonElement>(`[data-sq="${i}"]`)!
  const count = () => view.container.querySelectorAll('.sg-sq[data-p]').length
  return { onFinish, square, count, view }
}

describe('Shogi component', () => {
  it('selecting a piece highlights its moves; moving makes the computer answer once', () => {
    const { square, count } = setup()
    fireEvent.click(square(sq(6, 2)))
    expect(square(sq(6, 2)).dataset.sel).toBe('true')
    expect(square(sq(5, 2)).dataset.target).toBe('true')
    expect(square(sq(4, 2)).dataset.target).toBeUndefined()
    fireEvent.click(square(sq(5, 2)))
    expect(screen.getByText('Computer is thinking…')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(400))
    expect(screen.getByText('Your move')).toBeInTheDocument()
    expect(count()).toBe(40)
    expect(square(sq(5, 2)).dataset.p).toBe('1')
  })

  it('cannot select the computer\'s pieces or move off the highlighted squares', () => {
    const { square } = setup()
    fireEvent.click(square(sq(2, 2)))
    expect(square(sq(2, 2)).dataset.sel).toBeUndefined()
    fireEvent.click(square(sq(6, 2)))
    fireEvent.click(square(sq(3, 2)))
    expect(square(sq(3, 2)).dataset.p).toBeUndefined()
  })

  it('reports a finished game to onFinish exactly once, even in StrictMode, and asks about promotion', () => {
    const { square, onFinish } = setup('4k4/R8/9/9/9/9/9/8R/4K4 b - 1')
    fireEvent.click(square(sq(7, 8)))
    fireEvent.click(square(sq(0, 8)))
    // The rook may promote on the far row, so the game asks first.
    fireEvent.click(screen.getByRole('button', { name: 'Promote' }))
    act(() => void vi.advanceTimersByTime(5000))
    expect(screen.getByRole('heading', { name: 'You win!' })).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true, stats: { outcome: 1 } })
  })

  it('drops a piece from hand and lets the label style change', () => {
    const { square } = setup('4k4/9/9/9/9/9/9/9/4K4 b G 1')
    fireEvent.click(screen.getByRole('button', { name: 'gold in hand, 1' }))
    expect(square(sq(4, 4)).dataset.target).toBe('true')
    fireEvent.click(square(sq(4, 4)))
    expect(square(sq(4, 4)).dataset.k).toBe('5')
    fireEvent.click(screen.getByRole('button', { name: /Piece labels: Kanji/ }))
    expect(screen.getByRole('button', { name: /Piece labels: Letters/ })).toBeInTheDocument()
  })

  it('two players on one screen take turns and are never scored', () => {
    const { square, onFinish } = setup()
    fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'two' } })
    expect(screen.getByText('Black to move')).toBeInTheDocument()
    fireEvent.click(square(sq(6, 2)))
    fireEvent.click(square(sq(5, 2)))
    expect(screen.getByText('White to move')).toBeInTheDocument()
    fireEvent.click(square(sq(2, 6)))
    fireEvent.click(square(sq(3, 6)))
    expect(square(sq(3, 6)).dataset.p).toBe('2')
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('squares are keyboard-reachable buttons with readable names', () => {
    const { square } = setup()
    expect(square(sq(6, 2)).tagName).toBe('BUTTON')
    expect(square(sq(6, 2))).toHaveAccessibleName('7g, black pawn')
  })
})
