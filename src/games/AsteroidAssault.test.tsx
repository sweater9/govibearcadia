import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AsteroidAssault } from './AsteroidAssault'

// Under StrictMode (double-invoked effects), the loop must run once, and a finished game is reported once.

beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date', 'setTimeout', 'clearTimeout'] }))
afterEach(() => vi.useRealTimers())

function setup(seed = 'aa-component') {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <AsteroidAssault onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const field = view.container.querySelector<HTMLElement>('.aa-field')!
  const run = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
  return { onFinish, field, run, view }
}

describe('Rock Blaster component', () => {
  it('waits to start, then spawns the first wave of rocks', () => {
    const { field, run } = setup()
    expect(field.dataset.status).toBe('ready')
    fireEvent.keyDown(window, { key: ' ' })
    expect(field.dataset.status).toBe('playing')
    run(1500)
    expect(Number(field.dataset.rocks)).toBeGreaterThanOrEqual(3)
  })

  it('turns and thrusts from the keyboard, and pause stops the clock', () => {
    const { field, run } = setup()
    fireEvent.keyDown(window, { key: ' ' })
    run(200)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    run(300)
    fireEvent.keyUp(window, { key: 'ArrowRight' })
    expect(Number(field.dataset.angle)).toBeGreaterThan(0.5)
    fireEvent.keyDown(window, { key: 'p' })
    expect(field.dataset.status).toBe('paused')
    const angle = field.dataset.angle
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    run(500)
    expect(field.dataset.angle).toBe(angle)
    fireEvent.keyDown(window, { key: 'p' })
    expect(field.dataset.status).toBe('playing')
  })

  it('has touch buttons for turning, thrust and fire', () => {
    setup()
    for (const name of ['Turn left', 'Thrust', 'Turn right', 'Fire']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
  })

  it('reports a finished game exactly once, even in StrictMode', () => {
    const { onFinish, field, run } = setup('aa-once')
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'hard' } })
    fireEvent.keyDown(window, { key: ' ' })
    for (let i = 0; i < 4000 && field.dataset.status !== 'lost'; i++) run(1000)
    expect(field.dataset.status).toBe('lost')
    run(5000)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: false })
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
  })
})
