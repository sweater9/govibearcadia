import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The reporting contract for a win. Combat is covered by the rules tests; here `step` is replaced so the
// first frame wins, to check the component reports it exactly once.
vi.mock('./defender/rules', async (original) => {
  const rules = await original<typeof import('./defender/rules')>()
  return {
    ...rules,
    step: (s: import('./defender/rules').DefenderState) =>
      s.status === 'playing' ? { ...s, status: 'won' as const, wave: rules.WAVES, score: 5555, enemies: s.enemies.map(() => false) } : s,
  }
})

import { SpaceDefender } from './SpaceDefender'

beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date', 'setTimeout', 'clearTimeout'] }))
afterEach(() => vi.useRealTimers())

describe('Space Defender win', () => {
  it('reports a defended planet exactly once', () => {
    const onFinish = vi.fn()
    render(
      <StrictMode>
        <SpaceDefender onFinish={onFinish} seed="win" />
      </StrictMode>,
    )
    fireEvent.keyDown(window, { key: ' ' })
    act(() => void vi.advanceTimersByTime(16 * 10))
    expect(screen.getByText('Planet defended!')).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true, score: 5555, stats: { wave: 5 } })
    act(() => void vi.advanceTimersByTime(5000))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})
