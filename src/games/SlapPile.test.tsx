import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SlapPile } from './SlapPile'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('SlapPile', () => {
  it('shows the controls and starts with 26 cards each', () => {
    render(<StrictMode><SlapPile onFinish={() => {}} seed="t" /></StrictMode>)
    expect(screen.getByTestId('sp-count-0').textContent).toBe('26')
    expect(screen.getByTestId('sp-count-1').textContent).toBe('26')
    expect(screen.getByTestId('sp-slap')).toBeTruthy()
  })
  it('playing a card puts it on the pile', () => {
    render(<StrictMode><SlapPile onFinish={() => {}} seed="t" /></StrictMode>)
    fireEvent.click(screen.getByTestId('sp-play'))
    expect(screen.getByTestId('sp-pile-size').textContent).toBe('1 in pile')
  })
  it('reports a finished game exactly once under StrictMode', () => {
    const onFinish = vi.fn()
    render(<StrictMode><SlapPile onFinish={onFinish} seed="once" /></StrictMode>)
    // A game that runs to the play cap or a win ends; drive it with presses and time.
    for (let i = 0; i < 4000 && !screen.queryByTestId('sp-over'); i++) {
      const play = screen.getByTestId('sp-play') as HTMLButtonElement
      if (!play.disabled) fireEvent.click(play)
      act(() => { vi.advanceTimersByTime(50) })
    }
    expect(screen.queryByTestId('sp-over')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toHaveProperty('score')
  }, 30000)
})
