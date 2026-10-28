import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createRandom } from '../lib/rng'
import { ColorSort } from './ColorSort'
import { newGame, solve, type Move } from './colorsort/rules'

// Under StrictMode (double-invoked updaters and effects), the page must report each cleared run once.

const SEED = 'cs-component'

function setup(seed = SEED) {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <ColorSort onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const tube = (i: number) => view.container.querySelector<HTMLButtonElement>(`.csort-tube[data-i="${i}"]`)!
  const play = ([from, to]: Move) => {
    fireEvent.click(tube(from))
    fireEvent.click(tube(to))
  }
  return { onFinish, view, tube, play }
}

const solution = (seed = SEED) => solve(newGame(createRandom(seed)).tubes, 200000)!

describe('Color Sort component', () => {
  it('deals the seeded game', () => {
    const { tube } = setup()
    const expected = newGame(createRandom(SEED)).tubes
    expected.forEach((balls, i) => {
      const colors = Array.from(tube(i).querySelectorAll('.csort-ball')).map((b) => Number(b.getAttribute('data-color')))
      expect(colors).toEqual(balls)
    })
  })

  it('selects, deselects, and pours a ball', () => {
    const { tube, play } = setup()
    fireEvent.click(tube(0))
    expect(tube(0)).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(tube(0))
    expect(tube(0)).toHaveAttribute('aria-pressed', 'false')

    const first = solution()[0]
    play(first)
    expect(screen.getByText('Moves').nextElementSibling).toHaveTextContent('1')
  })

  it('an illegal target moves the pick instead of the ball', () => {
    const { tube, view } = setup()
    const tubes = newGame(createRandom(SEED)).tubes
    // two full tubes with different tops: pouring one onto the other is illegal (it is full)
    fireEvent.click(tube(0))
    fireEvent.click(tube(1))
    expect(screen.getByText('Moves').nextElementSibling).toHaveTextContent('0')
    expect(tube(1)).toHaveAttribute('aria-pressed', 'true')
    expect(view.container.querySelectorAll('.csort-ball')).toHaveLength(tubes.flat().length)
  })

  it('undo takes the last move back; keys 1-8 and U work too', () => {
    const { tube, play } = setup()
    const [from, to] = solution()[0]
    play([from, to])
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(screen.getByText('Moves').nextElementSibling).toHaveTextContent('0')
    fireEvent.keyDown(window, { key: String(from + 1) })
    expect(tube(from)).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(window, { key: String(to + 1) })
    expect(screen.getByText('Moves').nextElementSibling).toHaveTextContent('1')
    fireEvent.keyDown(window, { key: 'u' })
    expect(screen.getByText('Moves').nextElementSibling).toHaveTextContent('0')
  })

  it('reports a cleared game exactly once with the moves used', () => {
    const { onFinish, play } = setup()
    const moves = solution()
    for (const m of moves) play(m)
    expect(screen.getByText('Sorted!')).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true, stats: { moves: moves.length } })
    expect(onFinish.mock.calls[0][0].score).toBeGreaterThanOrEqual(100)
  })

  it('does not report a game that is abandoned, and New deals a fresh one', () => {
    const { onFinish, tube, play } = setup()
    play(solution()[0])
    fireEvent.click(screen.getByRole('button', { name: /New/ }))
    expect(onFinish).not.toHaveBeenCalled()
    expect(screen.getByText('Moves').nextElementSibling).toHaveTextContent('0')
    expect(tube(0)).toBeInTheDocument()
  })
})
