import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The reporting contract for a win. Physics is covered by the rules tests (including a bot that wins a
// match); here `step` is replaced so the first frame ends the match in the player's favour.
vi.mock('./pong/rules', async (original) => {
  const rules = await original<typeof import('./pong/rules')>()
  return {
    ...rules,
    step: (s: import('./pong/rules').PongState) =>
      s.status === 'playing' ? { ...s, status: 'won' as const, playerScore: rules.WIN_SCORE, aiScore: 3 } : s,
  }
})

import { NeonPong } from './NeonPong'

beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date', 'setTimeout', 'clearTimeout'] }))
afterEach(() => vi.useRealTimers())

describe('Neon Pong win', () => {
  it('reports a won match exactly once', () => {
    const onFinish = vi.fn()
    render(
      <StrictMode>
        <NeonPong onFinish={onFinish} seed="win" />
      </StrictMode>,
    )
    fireEvent.keyDown(window, { key: ' ' })
    act(() => void vi.advanceTimersByTime(16 * 10))
    expect(screen.getByText('You win!')).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true, score: 7 * 100 + 300 + 4 * 100 })
    act(() => void vi.advanceTimersByTime(5000))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})
