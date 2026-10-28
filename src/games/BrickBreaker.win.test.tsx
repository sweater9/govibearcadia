import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

// The reporting contract for a win. Physics is covered by the rules tests (including a bot that clears
// the board); here `step` is replaced so the very first frame clears the wall, to check the component
// reports a win exactly once and shows the result.
vi.mock('./breaker/rules', async (original) => {
  const rules = await original<typeof import('./breaker/rules')>()
  return {
    ...rules,
    step: (s: import('./breaker/rules').BreakerState) =>
      s.status === 'playing' ? { ...s, status: 'won' as const, score: 4321, broken: rules.TOTAL, bricks: s.bricks.map(() => false) } : s,
  }
})

import { BrickBreaker } from './BrickBreaker'

beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date', 'setTimeout', 'clearTimeout'] }))
afterEach(() => vi.useRealTimers())

describe('Brick Breaker win', () => {
  it('reports a cleared wall exactly once', () => {
    const onFinish = vi.fn()
    render(
      <StrictMode>
        <BrickBreaker onFinish={onFinish} seed="win" />
      </StrictMode>,
    )
    fireEvent.keyDown(window, { key: ' ' })
    act(() => void vi.advanceTimersByTime(16 * 10))
    expect(screen.getByText('Wall cleared!')).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true, score: 4321 })
    act(() => void vi.advanceTimersByTime(5000))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})
