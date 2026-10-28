import { StrictMode } from 'react'
import { act, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SpaceDefender } from './SpaceDefender'

// Under StrictMode (double-invoked effects), the loop must run once, and a finished game is reported once.

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
      <SpaceDefender onFinish={onFinish} seed="sd-component" />
    </StrictMode>,
  )
  const field = view.container.querySelector<HTMLElement>('.sd-field')!
  field.getBoundingClientRect = () => ({ left: 0, top: 0, right: 320, bottom: 420, width: 320, height: 420, x: 0, y: 0, toJSON: () => ({}) })
  const shipX = () => Number(view.container.querySelector('.sd-ship')!.getAttribute('data-x'))
  const enemies = () => view.container.querySelectorAll('.sd-enemy').length
  const frames = (n: number) => act(() => void vi.advanceTimersByTime(16 * n))
  const key = (k: string, type: 'keyDown' | 'keyUp' = 'keyDown') => fireEvent[type](window, { key: k })
  return { onFinish, view, field, shipX, enemies, frames, key }
}

describe('Space Defender component', () => {
  it('waits to start with a full formation and nothing in flight', () => {
    const { view, enemies, frames } = setup()
    frames(30)
    expect(enemies()).toBe(24)
    expect(view.container.querySelectorAll('.sd-bullet')).toHaveLength(0)
    expect(screen.getByText(/fires on its own/)).toBeInTheDocument()
  })

  it('Space starts the fight and the ship begins to fire by itself', () => {
    const { view, frames, key } = setup()
    key(' ')
    frames(5)
    expect(view.container.querySelectorAll('.sd-bullet').length).toBeGreaterThanOrEqual(1)
  })

  it('arrow keys move the ship while held, and the pointer places it', () => {
    const { field, shipX, frames, key } = setup()
    const x0 = shipX()
    key('ArrowRight')
    frames(30)
    key('ArrowRight', 'keyUp')
    const x1 = shipX()
    expect(x1).toBeGreaterThan(x0 + 50)
    frames(20)
    expect(shipX()).toBe(x1)
    pointer('pointerMove', field, 100)
    expect(shipX()).toBe(100)
    pointer('pointerMove', field, 1)
    expect(shipX()).toBe(13) // clamped at the wall
  })

  it('a pointer press starts the fight', () => {
    const { field, view, frames } = setup()
    pointer('pointerDown', field, 160)
    frames(5)
    expect(view.container.querySelectorAll('.sd-bullet').length).toBeGreaterThanOrEqual(1)
  })

  it('the ship shoots invaders down while it sits under them, and the score rises', () => {
    const { enemies, frames, key } = setup()
    key(' ')
    frames(60 * 6)
    expect(enemies()).toBeLessThan(24)
    expect(Number(screen.getByText('Score').nextElementSibling!.textContent)).toBeGreaterThan(0)
  })

  it('Space pauses and resumes', () => {
    const { view, frames, key } = setup()
    key(' ')
    frames(5)
    key(' ')
    expect(screen.getByText('Paused')).toBeInTheDocument()
    const before = view.container.querySelectorAll('.sd-enemy')[0].getAttribute('style')
    frames(60)
    expect(view.container.querySelectorAll('.sd-enemy')[0].getAttribute('style')).toBe(before)
    key(' ')
    frames(30)
    expect(view.container.querySelectorAll('.sd-enemy')[0].getAttribute('style')).not.toBe(before)
  })

  it('an unattended ship is overrun, and the game is reported exactly once', () => {
    const { onFinish, frames, key, field } = setup()
    pointer('pointerMove', field, 300) // sit in a corner, away from most of the invaders
    key(' ')
    frames(60 * 150)
    expect(screen.getByText('Overrun')).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: false })
    frames(600)
    expect(onFinish).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(screen.getByLabelText('3 lives')).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('restarting a run with no score is not recorded', () => {
    const { onFinish, key, frames } = setup()
    key(' ')
    frames(3)
    fireEvent.click(screen.getByRole('button', { name: 'New game' }))
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
