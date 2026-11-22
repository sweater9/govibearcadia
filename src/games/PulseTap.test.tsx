import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PulseTap } from './PulseTap'

describe('PulseTap', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reports a finished run exactly once under StrictMode, with 100 points per hit', () => {
    const onFinish = vi.fn()
    render(<StrictMode><PulseTap onFinish={onFinish} seed="t" /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Start run' }))
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Tap target' }))
    expect(onFinish).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(30_000) })
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ score: 300, durationMs: 30_000, stats: { hits: 3 } })
    expect(screen.getByText('You scored 300.')).toBeInTheDocument()
  })

  it('moves the target after a hit, deterministically for a seed, and a new run starts from zero and reports again', () => {
    const positions = (seed: string) => {
      const { unmount } = render(<PulseTap onFinish={() => {}} seed={seed} />)
      fireEvent.click(screen.getByRole('button', { name: 'Start run' }))
      const out: string[] = []
      for (let i = 0; i < 3; i++) {
        fireEvent.click(screen.getByRole('button', { name: 'Tap target' }))
        out.push(screen.getByRole('button', { name: 'Tap target' }).getAttribute('style') ?? '')
      }
      unmount()
      return out
    }
    expect(positions('same')).toEqual(positions('same'))
    expect(positions('same')).not.toEqual(positions('other'))

    const onFinish = vi.fn()
    render(<PulseTap onFinish={onFinish} seed="t" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start run' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tap target' }))
    act(() => { vi.advanceTimersByTime(30_000) })
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(screen.getByText('0')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(onFinish).toHaveBeenCalledTimes(2)
    expect(onFinish.mock.calls[1][0]).toMatchObject({ score: 0 })
  })
})
