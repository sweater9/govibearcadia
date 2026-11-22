import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryGrid } from './MemoryGrid'

const cards = () => Array.from(document.querySelectorAll<HTMLButtonElement>('.memory-grid button'))

/** Plays a full game through the UI: learn the symbols by flipping pairs, then match every pair. */
function solve() {
  const n = cards().length
  const symbol: string[] = []
  for (let i = 0; i < n; i += 2) {
    fireEvent.click(cards()[i])
    fireEvent.click(cards()[i + 1])
    symbol[i] = cards()[i].getAttribute('aria-label')!
    symbol[i + 1] = cards()[i + 1].getAttribute('aria-label')!
    act(() => { vi.advanceTimersByTime(700) })
  }
  const done = new Set<number>(cards().flatMap((c, i) => (c.className.includes('matched') ? [i] : [])))
  for (let i = 0; i < n; i++) {
    if (done.has(i)) continue
    const j = symbol.findIndex((s, k) => k !== i && s === symbol[i] && !done.has(k))
    fireEvent.click(cards()[i])
    fireEvent.click(cards()[j])
    done.add(i)
    done.add(j)
  }
}

describe('MemoryGrid', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reports a won run exactly once under StrictMode, with the moves it took', () => {
    const onFinish = vi.fn()
    render(<StrictMode><MemoryGrid onFinish={onFinish} seed="t" /></StrictMode>)
    expect(onFinish).not.toHaveBeenCalled()
    solve()
    act(() => { vi.advanceTimersByTime(2000) })
    expect(screen.getByText(/Perfect sync/)).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    const result = onFinish.mock.calls[0][0]
    expect(result).toMatchObject({ won: true })
    expect(result.stats.moves).toBeGreaterThanOrEqual(cards().length / 2)
    expect(result.score).toBeGreaterThanOrEqual(100)
  })

  it('a mismatched pair flips back, and Reset starts a clean board that can be reported again', () => {
    const onFinish = vi.fn()
    render(<MemoryGrid onFinish={onFinish} seed="t" />)
    solve()
    expect(onFinish).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /Reset/ }))
    expect(cards().every((c) => c.getAttribute('aria-label') === 'Hidden card')).toBe(true)
    solve()
    expect(onFinish).toHaveBeenCalledTimes(2)
  })
})
