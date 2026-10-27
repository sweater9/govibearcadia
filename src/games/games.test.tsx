import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryGrid } from './MemoryGrid'
import { NeonMerge } from './NeonMerge'
import { PulseTap } from './PulseTap'
import { scoreFor } from './memory/deck'

// StrictMode double-invokes state updaters and effects in development. These tests guard against
// the original bug where runs were recorded twice because side effects lived inside updaters.

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Pulse Tap', () => {
  it('reports each finished run exactly once', () => {
    const onFinish = vi.fn()
    render(
      <StrictMode>
        <PulseTap onFinish={onFinish} seed="pulse" />
      </StrictMode>,
    )

    fireEvent.click(screen.getByText('Start run'))
    fireEvent.click(screen.getByLabelText('Tap target'))
    fireEvent.click(screen.getByLabelText('Tap target'))
    act(() => {
      vi.advanceTimersByTime(30_000)
    })

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ score: 200, stats: { hits: 2 } }))
    expect(screen.getByText('Run complete')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Play again'))
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(onFinish).toHaveBeenCalledTimes(2)
    expect(onFinish).toHaveBeenLastCalledWith(expect.objectContaining({ score: 0 }))
  })

  it('does not report anything before a run starts', () => {
    const onFinish = vi.fn()
    render(
      <StrictMode>
        <PulseTap onFinish={onFinish} seed="idle" />
      </StrictMode>,
    )
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(onFinish).not.toHaveBeenCalled()
  })
})

describe('Memory Grid', () => {
  it('reports a cleared board exactly once', () => {
    const onFinish = vi.fn()
    const { container } = render(
      <StrictMode>
        <MemoryGrid onFinish={onFinish} seed="memory" />
      </StrictMode>,
    )
    const cards = () => Array.from(container.querySelectorAll<HTMLButtonElement>('.memory-grid button'))
    const isMatched = (i: number) => cards()[i].classList.contains('flipped')

    // Solve the board by discovery so the test does not depend on RNG internals.
    for (let i = 0; i < 12; i++) {
      if (isMatched(i)) continue
      for (let j = i + 1; j < 12; j++) {
        if (isMatched(j)) continue
        // A mismatch flips both cards back, so every attempt flips card i again, then card j.
        fireEvent.click(cards()[i])
        fireEvent.click(cards()[j])
        if (cards()[j].getAttribute('aria-label') === cards()[i].getAttribute('aria-label')) break
        act(() => {
          vi.advanceTimersByTime(700)
        })
      }
    }

    expect(onFinish).toHaveBeenCalledTimes(1)
    const result = onFinish.mock.calls[0][0]
    expect(result.won).toBe(true)
    expect(result.score).toBe(scoreFor(result.stats.moves))
    expect(screen.getByText(/Perfect sync/)).toBeInTheDocument()
  })
})

describe('Neon Merge', () => {
  it('reports an abandoned run once and ignores empty restarts', () => {
    const onFinish = vi.fn()
    const { container } = render(
      <StrictMode>
        <NeonMerge onFinish={onFinish} seed="merge-component" />
      </StrictMode>,
    )
    const keys = ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp']
    for (let i = 0; i < 40; i++) fireEvent.keyDown(window, { key: keys[i % 4] })

    const score = () => Number(container.querySelector('.game-toolbar strong')?.textContent)
    expect(score()).toBeGreaterThan(0)

    fireEvent.click(screen.getByText('New game'))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(score()).toBe(0)

    fireEvent.click(screen.getByText('New game'))
    fireEvent.click(screen.getByText('New game'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('records a score that matches what the player saw', () => {
    const onFinish = vi.fn()
    const { container } = render(<NeonMerge onFinish={onFinish} seed="score-match" />)
    const keys = ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp']
    for (let i = 0; i < 30; i++) fireEvent.keyDown(window, { key: keys[i % 4] })
    const shown = Number(container.querySelector('.game-toolbar strong')?.textContent)
    fireEvent.click(screen.getByText('New game'))
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ score: shown }))
  })
})
