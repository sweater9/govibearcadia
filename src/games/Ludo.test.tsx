import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Ludo } from './Ludo'
import { nearlyWon } from './ludo/endgame'

beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

describe('Ludo', () => {
  it('shows a 15x15 board, four tokens per colour in the yards and a Roll button', () => {
    const { container } = render(<Ludo onFinish={vi.fn()} seed="ui" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start match' }))
    expect(container.querySelectorAll('.ld-c')).toHaveLength(225)
    expect(container.querySelectorAll('.ld-token')).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeEnabled()
  })

  it('reports a finished run exactly once under StrictMode', () => {
    vi.useFakeTimers()
    const { seed, actions } = nearlyWon('unit-')
    localStorage.setItem('govibearcadia.ludo.v1', JSON.stringify({ count: 2, computers: 1, seed, actions, startedAt: 1 }))
    const onFinish = vi.fn()
    render(<StrictMode><Ludo onFinish={onFinish} seed={seed} /></StrictMode>)
    for (let i = 0; i < 10 && !onFinish.mock.calls.length; i++) {
      const roll = screen.queryByRole('button', { name: 'Roll dice' })
      if (roll && !roll.hasAttribute('disabled')) fireEvent.click(roll)
      act(() => { vi.advanceTimersByTime(1000) })
    }
    act(() => { vi.advanceTimersByTime(5000) })
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true })
  })
})
