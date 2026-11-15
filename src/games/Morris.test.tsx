import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRandom } from '../lib/rng'
import { NineMensMorris } from './Morris'
import { aiPly, apply, isOver, legalPlies, newGame, type Ply } from './morris/rules'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const THINK = 550

function setup(seed = 'nm-component') {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <NineMensMorris onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const point = (i: number) => view.container.querySelector<HTMLButtonElement>(`[data-pt="${i}"]`)!
  const cells = () => Array.from({ length: 24 }, (_, i) => Number(point(i).dataset.p ?? 0))
  return { onFinish, point, cells }
}

describe("Nine Men's Morris component", () => {
  it('placing a man makes the computer answer once, like the pure model', () => {
    const { point, cells } = setup()
    fireEvent.click(point(0))
    expect(screen.getByText('Computer is thinking…')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(THINK))
    const model = newGame()
    const after = apply(apply(model, { type: 'place', to: 0 }), aiPly(apply(model, { type: 'place', to: 0 }), createRandom('nm-component'), 'normal')!)
    expect(cells()).toEqual(after.cells)
    expect(screen.getByText('You: place a man')).toBeInTheDocument()
  })

  it('reports a finished game to onFinish exactly once, even in StrictMode', () => {
    const { point, cells, onFinish } = setup('nm-once')
    const ai = createRandom('nm-once')
    let model = newGame()
    const click = (ply: Ply) => {
      if (ply.type === 'place') fireEvent.click(point(ply.to))
      else if (ply.type === 'remove') fireEvent.click(point(ply.at))
      else {
        fireEvent.click(point(ply.from))
        fireEvent.click(point(ply.to))
      }
    }
    for (let guard = 0; !isOver(model) && guard < 600; guard++) {
      if (model.turn === 1) {
        const ply = legalPlies(model)[0]
        click(ply)
        model = apply(model, ply)
      } else {
        const ply = aiPly(model, ai, 'normal')!
        act(() => void vi.advanceTimersByTime(THINK))
        model = apply(model, ply)
      }
      expect(cells()).toEqual(model.cells)
    }
    expect(isOver(model)).toBe(true)
    act(() => void vi.advanceTimersByTime(5000))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: model.winner === 1 })
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
  })

  it('two players on one screen take turns and are never scored', () => {
    const { point, onFinish } = setup('nm-two')
    fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'two' } })
    expect(screen.getByText('Red: place a man')).toBeInTheDocument()
    fireEvent.click(point(0))
    expect(screen.getByText('Blue: place a man')).toBeInTheDocument()
    expect(point(0).dataset.p).toBe('1')
    fireEvent.click(point(5))
    expect(point(5).dataset.p).toBe('2')
    expect(onFinish).not.toHaveBeenCalled()
  })

  it('points are keyboard-reachable buttons with readable names', () => {
    const { point } = setup()
    expect(point(0).tagName).toBe('BUTTON')
    expect(point(0)).toHaveAccessibleName('ring 1, point 1, empty')
  })
})
