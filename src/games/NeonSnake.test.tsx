import { StrictMode } from 'react'
import { act, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRandom } from '../lib/rng'
import { NeonSnake } from './NeonSnake'
import { begin, newGame, step, type SnakeState } from './snake/rules'

// Run under StrictMode, which double-invokes updaters and effects in development. The snake must
// move exactly one cell per tick, draw its random stream once per move, and report each run once.

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const SEED = 'snake-component'
const TICK = 140 // the opening speed, before any food is eaten

function setup(seed = SEED) {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <NeonSnake onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const head = () => {
    const el = view.container.querySelector('.snake-seg.head')!
    return [Number(el.getAttribute('data-x')), Number(el.getAttribute('data-y'))]
  }
  const board = () => view.container.querySelector('.snake-board')!
  // One move: advance the clock, and let React re-render so the next timer is scheduled.
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) act(() => void vi.advanceTimersByTime(TICK))
  }
  const key = (k: string) => fireEvent.keyDown(window, { key: k })
  return { onFinish, view, head, board, tick, key }
}

/** Plays the pure rules straight to the first wall crash, the way the component will with no input. */
function crashScore(seed = SEED): number {
  const random = createRandom(seed)
  let state: SnakeState = begin(newGame(random))
  while (state.status === 'playing') state = step(state, random)
  return state.eaten * 10
}

describe('Neon Snake component', () => {
  it('waits for the player, then moves exactly one cell per tick', () => {
    const { head, tick, key } = setup()
    tick(5)
    expect(head()).toEqual([9, 9]) // still waiting
    expect(screen.getByText(/Press an arrow key/)).toBeInTheDocument()

    key('ArrowUp')
    tick()
    expect(head()).toEqual([9, 8])
    tick(2)
    expect(head()).toEqual([9, 6])
  })

  it('deals the same food for the same seed', () => {
    const { view } = setup()
    const food = view.container.querySelector('.snake-food')!
    const expected = newGame(createRandom(SEED)).food!
    expect([Number(food.getAttribute('data-x')), Number(food.getAttribute('data-y'))]).toEqual([expected.x, expected.y])
  })

  it('starts from the Start button too', () => {
    const { head, tick } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    tick()
    expect(head()).toEqual([10, 9])
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('ignores reversing, and plays two quick turns on consecutive ticks', () => {
    const { head, tick, key } = setup()
    key('w')
    key('s') // opposite of up: ignored
    tick(2)
    expect(head()).toEqual([9, 7])

    key('ArrowRight')
    key('ArrowDown') // queued behind the right turn
    tick(2)
    expect(head()).toEqual([10, 8])
  })

  it('accepts WASD and arrow keys', () => {
    const { head, tick, key } = setup()
    key('s')
    tick()
    expect(head()).toEqual([9, 10])
    key('d')
    tick()
    expect(head()).toEqual([10, 10])
    key('ArrowUp')
    tick()
    expect(head()).toEqual([10, 9])
    key('a')
    tick()
    expect(head()).toEqual([9, 9])
  })

  it('reports a crash exactly once, with the score the rules produce', () => {
    const { onFinish, tick, key } = setup()
    key('ArrowRight') // heading right already; this just starts the run
    tick(40)
    expect(screen.getByText('Crashed')).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ score: crashScore(), won: false })
    tick(20)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('does not delay the next move when a turn is pressed in the middle of a tick', () => {
    const { head, key } = setup()
    key('ArrowRight') // already heading right: this just starts the run
    act(() => void vi.advanceTimersByTime(TICK))
    expect(head()).toEqual([10, 9])

    act(() => void vi.advanceTimersByTime(100)) // 100ms into the next tick...
    key('ArrowUp') // ...a turn arrives
    act(() => void vi.advanceTimersByTime(40)) // the tick is still due at 140ms
    expect(head()).toEqual([10, 8])
  })

  it('draws each new food from the seeded stream exactly once, even under StrictMode', () => {
    const seed = Array.from({ length: 2000 }, (_, i) => `eat-${i}`).find((s) => {
      const food = newGame(createRandom(s)).food!
      return food.y === 9 && food.x > 9 && food.x <= 12
    })!
    // The model plays the same moves with the same stream; the page must deal the same next food.
    const random = createRandom(seed)
    let model: SnakeState = begin(newGame(random))
    let moves = 0
    while (model.eaten < 1) {
      model = step(model, random)
      moves++
    }
    const { view, tick, key } = setup(seed)
    key('ArrowRight')
    tick(moves)

    expect(view.container.querySelectorAll('.snake-seg')).toHaveLength(4)
    const food = view.container.querySelector('.snake-food')!
    expect([Number(food.getAttribute('data-x')), Number(food.getAttribute('data-y'))]).toEqual([model.food!.x, model.food!.y])
  })

  it('pauses and resumes with the button and with Space', () => {
    const { head, tick, key } = setup()
    key('ArrowUp')
    tick()
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(screen.getByText('Paused')).toBeInTheDocument()
    tick(10)
    expect(head()).toEqual([9, 8]) // frozen

    key(' ') // Space resumes
    expect(screen.queryByText('Paused')).toBeNull()
    tick()
    expect(head()).toEqual([9, 7])

    key('p')
    tick(5)
    expect(head()).toEqual([9, 7])
  })

  it('ignores turns while paused', () => {
    const { head, tick, key } = setup()
    key('ArrowUp')
    tick()
    key('p')
    key('ArrowLeft')
    key('p')
    tick()
    expect(head()).toEqual([9, 7]) // kept going up; the left turn was never queued
  })

  it('pauses when the tab is hidden', () => {
    const { board, tick, key } = setup()
    key('ArrowUp')
    tick()
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    expect(board().getAttribute('data-status')).toBe('paused')
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  })

  it('steers with the on-screen pad', () => {
    const { head, tick } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Down' }))
    tick()
    expect(head()).toEqual([9, 10])
    fireEvent.click(screen.getByRole('button', { name: 'Right' }))
    tick()
    expect(head()).toEqual([10, 10])
  })

  it('steers with swipes, and ignores a tiny touch', () => {
    const { head, tick, board } = setup()
    const swipe = (dx: number, dy: number) => {
      const start = createEvent.touchStart(board())
      Object.defineProperty(start, 'touches', { value: [{ clientX: 100, clientY: 100 }] })
      fireEvent(board(), start)
      const end = createEvent.touchEnd(board())
      Object.defineProperty(end, 'changedTouches', { value: [{ clientX: 100 + dx, clientY: 100 + dy }] })
      fireEvent(board(), end)
    }
    swipe(4, 3) // too short: not even a start
    tick(3)
    expect(head()).toEqual([9, 9])

    swipe(5, -60)
    tick()
    expect(head()).toEqual([9, 8])
    swipe(70, 10)
    tick()
    expect(head()).toEqual([10, 8])
  })

  it('does not record a fresh run that is restarted, but records an abandoned run that scored', () => {
    // The random stream carries on across "New", so mirror it: find a seed whose SECOND game has its
    // first food straight ahead on the opening row, and whose first game does not.
    const dealt = (seed: string) => {
      const random = createRandom(seed)
      return [newGame(random).food!, newGame(random).food!]
    }
    const seed = Array.from({ length: 2000 }, (_, i) => `ahead-${i}`).find((s) => {
      const [first, second] = dealt(s)
      return first.y !== 9 && second.y === 9 && second.x > 9
    })!
    const [, second] = dealt(seed)
    const { onFinish, view, tick, key } = setup(seed)

    key('ArrowRight')
    tick(2)
    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    expect(onFinish).not.toHaveBeenCalled() // nothing scored, nothing recorded

    key('ArrowRight')
    tick(second.x - 9) // reaches and eats the food
    expect(view.container.querySelectorAll('.snake-seg')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'New' }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ score: 10, won: false })
  })
})
