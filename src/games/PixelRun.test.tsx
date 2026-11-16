import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PixelRun } from './PixelRun'

// Under StrictMode (double-invoked effects), the loop must run once, and a finished run is reported once.

beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date', 'setTimeout', 'clearTimeout'] }))
afterEach(() => vi.useRealTimers())

function setup(seed = 'pr-component') {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <PixelRun onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const field = view.container.querySelector<HTMLElement>('.pr-field')!
  const run = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
  return { onFinish, field, run, view }
}

describe('Pixel Run component', () => {
  it('waits to start, then runs on Space', () => {
    const { field } = setup()
    expect(field.dataset.status).toBe('ready')
    fireEvent.keyDown(window, { key: ' ' })
    expect(field.dataset.status).toBe('playing')
  })

  it('runs right from the keyboard and pause freezes the world', () => {
    const { field, run } = setup()
    fireEvent.keyDown(window, { key: ' ' })
    fireEvent.keyUp(window, { key: ' ' })
    const x0 = Number(field.dataset.x)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    run(400)
    fireEvent.keyUp(window, { key: 'ArrowRight' })
    const x1 = Number(field.dataset.x)
    expect(x1).toBeGreaterThan(x0 + 15)
    fireEvent.keyDown(window, { key: 'p' })
    expect(field.dataset.status).toBe('paused')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    run(500)
    expect(field.dataset.x).toBe(String(x1))
    fireEvent.keyDown(window, { key: 'p' })
    expect(field.dataset.status).toBe('playing')
  })

  it('has touch buttons for left, right and jump', () => {
    setup()
    for (const name of ['Move left', 'Move right', 'Jump']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
  })

  it('holding a touch button moves the hero', () => {
    const { field, run } = setup()
    const right = screen.getByRole('button', { name: 'Move right' })
    fireEvent.pointerDown(right)
    run(300)
    fireEvent.pointerUp(right)
    expect(Number(field.dataset.x)).toBeGreaterThan(40)
  })

  it('reports a finished run exactly once, even in StrictMode', () => {
    const { onFinish, field, run } = setup('pr-once')
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'hard' } })
    fireEvent.keyDown(window, { key: ' ' })
    // Standing still, walkers or the timer take the lives.
    for (let i = 0; i < 10 && field.dataset.status !== 'lost'; i++) run(56000)
    expect(field.dataset.status).toBe('lost')
    run(2000)
    expect(onFinish).toHaveBeenCalledTimes(1)
    const result = onFinish.mock.calls[0][0]
    expect(result.won).toBe(false)
    expect(result.stats).toMatchObject({ deaths: 2, levels: 0 })
    expect(result.durationMs).toBeGreaterThan(1000)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(field.dataset.status).toBe('ready')
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('does not report an untouched restart', () => {
    const { onFinish } = setup('pr-restart')
    fireEvent.click(screen.getByRole('button', { name: 'New game' }))
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('deals the same level order for the same seed', () => {
    const a = setup('same')
    const b = setup('same')
    const label = (f: HTMLElement) => f.getAttribute('aria-label')
    expect(label(a.field)).toBe(label(b.field))
  })
})
