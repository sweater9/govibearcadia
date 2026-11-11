import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Poker } from './Poker'
import { chooseAction } from './poker/bot'
import { applyAction, newGame } from './poker/rules'

beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

describe('Poker', () => {
  it('shows setup first, then deals two cards and posts the blinds', () => {
    const { container } = render(<Poker onFinish={vi.fn()} seed="ui" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start tournament' }))
    expect(container.querySelectorAll('.pk-me .pk-card')).toHaveLength(2)
    expect(container.querySelectorAll('.pk-seats li')).toHaveLength(2)
    expect(screen.getByText(/Blinds 10\/20/)).toBeInTheDocument()
  })

  it('reports a finished tournament exactly once under StrictMode', () => {
    vi.useFakeTimers()
    // Stage a heads-up tournament played by the computer up to the last hand, so the human only has to finish it.
    let s = newGame(2, 'unit-fin')
    const actions = []
    let steps = 0
    while (s.street !== 'over' && steps++ < 20000) {
      const a = s.street === 'showdown' ? ({ type: 'next' } as const) : chooseAction(s)
      actions.push(a)
      s = applyAction(s, a)
    }
    expect(s.street).toBe('over')
    localStorage.setItem('govibearcadia.poker.v1', JSON.stringify({ players: 2, seed: 'unit-fin', actions, startedAt: 1 }))
    const onFinish = vi.fn()
    render(<StrictMode><Poker onFinish={onFinish} seed="unit-fin" /></StrictMode>)
    // A reloaded finished tournament is shown but not reported again.
    act(() => { vi.advanceTimersByTime(5000) })
    expect(onFinish).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
  })

  it('folding every hand until busted reports once', () => {
    vi.useFakeTimers()
    const onFinish = vi.fn()
    render(<StrictMode><Poker onFinish={onFinish} seed="fold-out" /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Start tournament' }))
    for (let i = 0; i < 400 && !onFinish.mock.calls.length; i++) {
      const fold = screen.queryByRole('button', { name: 'Fold' })
      if (fold && !fold.hasAttribute('disabled')) fireEvent.click(fold)
      const next = screen.queryByRole('button', { name: /Next hand|See result/ })
      if (next) fireEvent.click(next)
      act(() => { vi.advanceTimersByTime(1000) })
    }
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: false })
  })
})
