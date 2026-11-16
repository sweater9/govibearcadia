import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MarbleMaze } from './MarbleMaze'
import { centre, newGame } from './marble/rules'
import { autopilot } from './marble/solver'

// Under StrictMode (double-invoked effects), the loop must run once, and a finished game is reported once.

beforeEach(() => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date', 'setTimeout', 'clearTimeout'] }))
afterEach(() => vi.useRealTimers())

function setup(seed = 'mz-component') {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <MarbleMaze onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const board = view.container.querySelector<HTMLElement>('.mz-board')!
  const run = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
  return { onFinish, board, run, view }
}

const KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const

describe('Marble Maze component', () => {
  it('waits to start, rolls with the arrow keys, and pause stops the clock', () => {
    const { board, run } = setup()
    expect(board.dataset.status).toBe('ready')
    const x0 = Number(board.dataset.x)
    const y0 = Number(board.dataset.y)
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(board.dataset.status).toBe('playing')
    run(300)
    fireEvent.keyUp(window, { key: 'ArrowDown' })
    expect(Number(board.dataset.y)).toBeGreaterThan(y0)
    expect(Number(board.dataset.x)).toBeCloseTo(x0, 0)
    fireEvent.keyDown(window, { key: 'p' })
    expect(board.dataset.status).toBe('paused')
    const y = board.dataset.y
    run(500)
    expect(board.dataset.y).toBe(y)
    fireEvent.keyDown(window, { key: 'p' })
    expect(board.dataset.status).toBe('playing')
  })

  it('has a difficulty select that changes the maze', () => {
    const { board } = setup()
    expect(board.dataset.level).toBe('normal')
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'hard' } })
    expect(board.dataset.level).toBe('hard')
  })

  it('reports a finished run exactly once, even in StrictMode', () => {
    const { onFinish, board, run } = setup('mz-once')
    // Drive the real component with the same autopilot the rules tests use, reading the state from the board.
    const state = newGame('normal', 'mz-once:0')
    fireEvent.keyDown(window, { key: ' ' })
    let held: string[] = []
    let px = Number(board.dataset.x)
    let py = Number(board.dataset.y)
    for (let tick = 0; tick < 6000 && board.dataset.status === 'playing'; tick++) {
      const x = Number(board.dataset.x)
      const y = Number(board.dataset.y)
      const s = { ...state, x, y, vx: (x - px) / 0.05, vy: (y - py) / 0.05 }
      px = x
      py = y
      const k = autopilot(s)
      const want = (Object.keys(KEYS) as (keyof typeof KEYS)[]).filter((n) => k[n]).map((n): string => KEYS[n])
      for (const key of held) if (!want.includes(key)) fireEvent.keyUp(window, { key })
      for (const key of want) if (!held.includes(key)) fireEvent.keyDown(window, { key })
      held = want
      run(50)
    }
    for (const key of held) fireEvent.keyUp(window, { key })
    expect(centre(state.goal).x).toBeGreaterThan(0)
    expect(board.dataset.status).toBe('won')
    run(5000)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true })
    expect(onFinish.mock.calls[0][0].score).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
  })
})
