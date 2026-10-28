import { StrictMode } from 'react'
import { act, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NeonPong } from './NeonPong'

// Under StrictMode (double-invoked effects), the loop must run once, and a finished match is reported once.

beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date', 'setTimeout', 'clearTimeout'] }))
afterEach(() => vi.useRealTimers())

/** jsdom's generic pointer events carry no coordinates, so add them. */
const pointer = (type: 'pointerMove' | 'pointerDown', el: Element, clientX: number) => {
  const event = createEvent[type](el)
  Object.defineProperty(event, 'clientX', { value: clientX })
  fireEvent(el, event)
}

function setup() {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <NeonPong onFinish={onFinish} seed="pong-component" />
    </StrictMode>,
  )
  const field = view.container.querySelector<HTMLElement>('.pong-field')!
  field.getBoundingClientRect = () => ({ left: 0, top: 0, right: 320, bottom: 420, width: 320, height: 420, x: 0, y: 0, toJSON: () => ({}) })
  const num = (sel: string, name: string) => Number(view.container.querySelector(sel)!.getAttribute(name))
  const frames = (n: number) => act(() => void vi.advanceTimersByTime(16 * n))
  const key = (k: string, type: 'keyDown' | 'keyUp' = 'keyDown') => fireEvent[type](window, { key: k })
  /** Keeps the player's paddle on the far side from the ball. */
  const evade = (until: () => boolean, maxFrames = 60 * 120) => {
    for (let i = 0; i < maxFrames / 5 && !until(); i++) {
      pointer('pointerMove', field, num('.pong-ball', 'data-x') < 160 ? 310 : 10)
      frames(5)
    }
  }
  return { onFinish, view, field, num, frames, key, evade }
}

describe('Neon Pong component', () => {
  it('waits for the serve with the ball in the middle', () => {
    const { num, frames } = setup()
    frames(30)
    expect(num('.pong-ball', 'data-x')).toBe(160)
    expect(num('.pong-ball', 'data-y')).toBe(210)
    expect(screen.getByText(/to serve/)).toBeInTheDocument()
    expect(screen.getByLabelText('You 0, computer 0')).toBeInTheDocument()
  })

  it('the arrow keys move the player paddle while held', () => {
    const { num, frames, key } = setup()
    const x0 = num('.pong-paddle.you', 'data-x')
    key('ArrowRight')
    frames(30)
    key('ArrowRight', 'keyUp')
    const x1 = num('.pong-paddle.you', 'data-x')
    expect(x1).toBeGreaterThan(x0 + 50)
    frames(30)
    expect(num('.pong-paddle.you', 'data-x')).toBe(x1)
  })

  it('the pointer sets the paddle position and clamps at the walls', () => {
    const { field, num } = setup()
    pointer('pointerMove', field, 100)
    expect(num('.pong-paddle.you', 'data-x')).toBe(100)
    pointer('pointerMove', field, 2)
    expect(num('.pong-paddle.you', 'data-x')).toBe(30)
  })

  it('Space serves toward the player; Space then pauses and resumes', () => {
    const { num, frames, key } = setup()
    key(' ')
    frames(20)
    const y1 = num('.pong-ball', 'data-y')
    expect(y1).toBeGreaterThan(210)
    key(' ')
    expect(screen.getByText('Paused')).toBeInTheDocument()
    frames(60)
    expect(num('.pong-ball', 'data-y')).toBe(y1)
    key(' ')
    frames(10)
    expect(num('.pong-ball', 'data-y')).toBeGreaterThan(y1)
  })

  it('a pointer press serves too', () => {
    const { field, num, frames } = setup()
    pointer('pointerDown', field, 160)
    frames(15)
    expect(num('.pong-ball', 'data-y')).not.toBe(210)
  })

  it('a missed ball scores for the computer and waits for the next serve', () => {
    const { num, frames, key, evade } = setup()
    key(' ')
    evade(() => screen.queryByLabelText('You 0, computer 1') !== null)
    expect(screen.getByLabelText('You 0, computer 1')).toBeInTheDocument()
    frames(5)
    expect(num('.pong-ball', 'data-x')).toBe(160) // back in the middle
    expect(screen.getByText(/to serve/)).toBeInTheDocument()
  })

  it('reports once when the computer reaches seven, and nothing afterwards', () => {
    const { onFinish, frames, key, evade } = setup()
    for (let p = 0; p < 7; p++) {
      key(' ')
      evade(() => screen.queryByLabelText(`You 0, computer ${p + 1}`) !== null)
    }
    expect(screen.getByText('CPU wins')).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: false, score: 0, stats: { points: 0, conceded: 7 } })
    frames(600)
    expect(onFinish).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(screen.getByLabelText('You 0, computer 0')).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('restarting a run with no points is not recorded', () => {
    const { onFinish, key, frames } = setup()
    key(' ')
    frames(5)
    fireEvent.click(screen.getByRole('button', { name: /New/ }))
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('pauses when the tab is hidden', () => {
    const { key, frames } = setup()
    key(' ')
    frames(5)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    expect(screen.getByText('Paused')).toBeInTheDocument()
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  })
})
