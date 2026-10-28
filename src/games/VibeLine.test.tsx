import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { VibeLine } from './VibeLine'
import { createRandom } from '../lib/rng'
import { newGame } from './vibeline/rules'

const SEED = 'vl-component'

function setup() {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <VibeLine onFinish={onFinish} seed={SEED} />
    </StrictMode>,
  )
  // The first dealt puzzle is 5x5 from this seed.
  const solution = newGame(5, createRandom(SEED)).puzzle.solution
  const board = screen.getByRole('group', { name: /VibeLine 5 by 5/ })
  const move = (key: string) => fireEvent.keyDown(board, { key })
  const onLine = () => view.container.querySelectorAll('[data-on]').length
  return { onFinish, view, solution, board, move, onLine }
}

const KEY = (n: number, a: number, b: number) => (b === a + 1 ? 'ArrowRight' : b === a - 1 ? 'ArrowLeft' : b === a + n ? 'ArrowDown' : 'ArrowUp')

describe('VibeLine component', () => {
  it('starts with the line on number 1 and the next number shown', () => {
    const { onLine } = setup()
    expect(onLine()).toBe(1)
    expect(screen.getByLabelText('Next number')).toHaveTextContent('2')
  })

  it('draws with arrow keys, undoes with Z and resets', () => {
    const { solution, move, onLine } = setup()
    move(KEY(5, solution[0], solution[1]))
    move(KEY(5, solution[1], solution[2]))
    expect(onLine()).toBe(3)
    move('z')
    expect(onLine()).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(onLine()).toBe(1)
  })

  it('reports a finished line exactly once under StrictMode', () => {
    const { onFinish, solution, move } = setup()
    for (let i = 1; i < solution.length; i++) move(KEY(5, solution[i - 1], solution[i]))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ won: true, stats: { size: 5, numbers: 7 } }))
    expect(screen.getByText(/Line complete/)).toBeInTheDocument()
    move('z')
    move('ArrowUp')
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('changing size deals a new board without reporting anything', () => {
    const { onFinish, view } = setup()
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: '4' } })
    expect(view.container.querySelectorAll('[data-cell]')).toHaveLength(16)
    expect(onFinish).not.toHaveBeenCalled()
  })
})
