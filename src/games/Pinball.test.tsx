import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Pinball } from './Pinball'

// A ball that is already below the table drains on the first tick, so a whole game ends without simulating physics.
vi.mock('./pinball/rules', async (importOriginal) => {
  const real = await importOriginal<typeof import('./pinball/rules')>()
  return {
    ...real,
    step: (s: import('./pinball/rules').State) => {
      if (s.status !== 'playing') return s
      return real.step({ ...s, ball: { ...s.ball, y: real.H + 40 }, played: s.played + 1000 }, 16)
    },
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number)
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const tick = (ms = 100) => act(() => void vi.advanceTimersByTime(ms))

describe('Pinball', () => {
  it('reports a finished game exactly once under StrictMode, after three balls', () => {
    const onFinish = vi.fn()
    render(<StrictMode><Pinball onFinish={onFinish} seed="u" /></StrictMode>)
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Launch ball' }))
      tick()
    }
    expect(screen.getByText('Game over')).toBeInTheDocument()
    tick(1000)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: false, stats: { balls: 3 } })
    expect(onFinish.mock.calls[0][0].durationMs).toBeGreaterThan(0)
  })

  it('Play again starts a fresh game and the next game reports once more', () => {
    const onFinish = vi.fn()
    render(<Pinball onFinish={onFinish} seed="u" />)
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Launch ball' }))
      tick()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(screen.getByRole('button', { name: 'Launch ball' })).toBeInTheDocument()
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Launch ball' }))
      tick()
    }
    expect(onFinish).toHaveBeenCalledTimes(2)
  })

  it('works the flippers from the keyboard and releases them on key up', () => {
    render(<Pinball onFinish={vi.fn()} seed="u" />)
    const left = () => document.querySelector('[data-side="left"]')!.getAttribute('data-held')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(left()).toBe('true')
    fireEvent.keyUp(window, { key: 'ArrowLeft' })
    expect(left()).toBe('false')
    fireEvent.keyDown(window, { key: 'Shift', code: 'ShiftRight' })
    expect(document.querySelector('[data-side="right"]')!.getAttribute('data-held')).toBe('true')
  })

  it('launches with Space and pauses with P or Escape; nothing moves while paused', () => {
    render(<Pinball onFinish={vi.fn()} seed="u" />)
    const table = () => document.querySelector('.pb-table')!
    fireEvent.keyDown(window, { key: ' ' })
    expect(table().getAttribute('data-status')).toBe('playing')
    fireEvent.keyDown(window, { key: 'p' })
    expect(table().getAttribute('data-paused')).toBe('true')
    expect(screen.getByText('Paused')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(document.querySelector('[data-side="left"]')!.getAttribute('data-held')).toBe('false')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(table().getAttribute('data-paused')).toBe('false')
  })

  it('touch: the left half of the table works the left flipper, the right half the right', () => {
    render(<Pinball onFinish={vi.fn()} seed="u" />)
    const table = document.querySelector('.pb-table') as HTMLElement
    table.getBoundingClientRect = () => ({ left: 0, right: 200, top: 0, bottom: 320, width: 200, height: 320, x: 0, y: 0, toJSON: () => ({}) })
    // jsdom has no PointerEvent, so build one from a MouseEvent that carries the pointer id.
    const pointer = (type: string, pointerId: number, clientX = 0) => {
      const e = new MouseEvent(type, { bubbles: true, clientX, clientY: 100 })
      Object.defineProperty(e, 'pointerId', { value: pointerId })
      fireEvent(table, e)
    }
    pointer('pointerdown', 1, 20)
    expect(document.querySelector('[data-side="left"]')!.getAttribute('data-held')).toBe('true')
    expect(document.querySelector('[data-side="right"]')!.getAttribute('data-held')).toBe('false')
    pointer('pointerup', 1)
    expect(document.querySelector('[data-side="left"]')!.getAttribute('data-held')).toBe('false')
    pointer('pointerdown', 2, 180)
    expect(document.querySelector('[data-side="right"]')!.getAttribute('data-held')).toBe('true')
  })

  it('has three levels on the intro screen', () => {
    render(<Pinball onFinish={vi.fn()} seed="u" />)
    const group = screen.getByRole('group', { name: 'Level' })
    expect(group.querySelectorAll('button')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: 'Hard' }))
    expect(screen.getByRole('button', { name: 'Hard' })).toHaveAttribute('aria-pressed', 'true')
  })
})
