import { StrictMode } from 'react'
import { act, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrickBreaker } from './BrickBreaker'

// Under StrictMode (double-invoked effects), the loop must run once, and a finished game is reported once.

beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date', 'setTimeout', 'clearTimeout'] }))
afterEach(() => vi.useRealTimers())

function setup() {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <BrickBreaker onFinish={onFinish} seed="brk-component" />
    </StrictMode>,
  )
  const field = view.container.querySelector<HTMLElement>('.brk-field')!
  field.getBoundingClientRect = () => ({ left: 0, top: 0, right: 320, bottom: 420, width: 320, height: 420, x: 0, y: 0, toJSON: () => ({}) })
  const num = (el: Element, name: string) => Number(el.getAttribute(name))
  const ball = () => view.container.querySelector('.brk-ball')!
  const paddle = () => view.container.querySelector('.brk-paddle')!
  const frames = (n: number) => act(() => void vi.advanceTimersByTime(16 * n))
  const key = (k: string, type: 'keyDown' | 'keyUp' = 'keyDown') => fireEvent[type](window, { key: k })
  return { onFinish, view, field, ball, paddle, num, frames, key }
}

/** jsdom's generic pointer events carry no coordinates, so add them. */
const pointer = (type: 'pointerMove' | 'pointerDown', el: Element, clientX: number) => {
  const event = createEvent[type](el)
  Object.defineProperty(event, 'clientX', { value: clientX })
  fireEvent(el, event)
}

describe('Brick Breaker component', () => {
  it('waits for the serve, with the ball on the paddle', () => {
    const { ball, paddle, num, frames } = setup()
    frames(30)
    expect(num(ball(), 'data-x')).toBe(num(paddle(), 'data-x'))
    expect(screen.getByText(/to serve/)).toBeInTheDocument()
  })

  it('the arrow keys move the paddle while held, and stop on release', () => {
    const { paddle, num, frames, key } = setup()
    const start = num(paddle(), 'data-x')
    key('ArrowRight')
    frames(30)
    const moved = num(paddle(), 'data-x')
    expect(moved).toBeGreaterThan(start + 50)
    key('ArrowRight', 'keyUp')
    frames(30)
    expect(num(paddle(), 'data-x')).toBe(moved)
    key('a')
    frames(10)
    key('a', 'keyUp')
    expect(num(paddle(), 'data-x')).toBeLessThan(moved)
  })

  it('the pointer sets the paddle position', () => {
    const { field, paddle, num } = setup()
    pointer('pointerMove', field, 100)
    expect(num(paddle(), 'data-x')).toBe(100)
    pointer('pointerMove', field, 1) // clamped to the wall
    expect(num(paddle(), 'data-x')).toBe(32)
  })

  it('Space serves; the ball then rises, and Space pauses and resumes it', () => {
    const { ball, num, frames, key } = setup()
    const y0 = num(ball(), 'data-y')
    key(' ')
    frames(20)
    const y1 = num(ball(), 'data-y')
    expect(y1).toBeLessThan(y0)

    key(' ') // pause
    expect(screen.getByText('Paused')).toBeInTheDocument()
    frames(60)
    expect(num(ball(), 'data-y')).toBe(y1)

    key(' ') // resume
    frames(10)
    expect(num(ball(), 'data-y')).not.toBe(y1)
  })

  it('a pointer press serves too', () => {
    const { field, ball, num, frames } = setup()
    const y0 = num(ball(), 'data-y')
    pointer('pointerDown', field, 160)
    frames(15)
    expect(num(ball(), 'data-y')).toBeLessThan(y0)
  })

  it('losing a ball costs a life and waits for the next serve', () => {
    const { ball, paddle, num, frames, key, field } = setup()
    pointer('pointerMove', field, 32) // park the paddle far left; the ball goes up the middle-ish
    key(' ')
    frames(60 * 8)
    expect(screen.getByLabelText('2 lives')).toBeInTheDocument()
    expect(num(ball(), 'data-x')).toBe(num(paddle(), 'data-x')) // back on the paddle
  })

  it('reports once when the last life is lost, and nothing more afterwards', () => {
    const { onFinish, frames, key, field } = setup()
    for (let life = 0; life < 3; life++) {
      pointer('pointerMove', field, 300)
      key(' ')
      frames(60 * 10)
    }
    expect(screen.getByText('Game over')).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: false, stats: { lives: 0 } })
    frames(600)
    expect(onFinish).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(screen.getByLabelText('3 lives')).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('a fresh run restarted without scoring is not recorded', () => {
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
