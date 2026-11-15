import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRandom } from '../lib/rng'
import { ChineseCheckers } from './ChineseCheckers'
import { aiMove, isOver, legalMoves, move, newGame, TURN_LIMIT } from './chinese/rules'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const THINK = 350

function setup(seed = 'cc-component') {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <ChineseCheckers onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const hole = (i: number) => view.container.querySelector<HTMLButtonElement>(`[data-pt="${i}"]`)!
  const cells = () => Array.from(view.container.querySelectorAll<HTMLElement>('[data-pt]')).map((el) => Number(el.dataset.p ?? 0))
  return { onFinish, hole, cells }
}

describe('Chinese Checkers component', () => {
  it('selecting a man highlights its moves; moving makes the computer answer, like the pure model', () => {
    const { hole, cells } = setup()
    const model = newGame(2)
    const m = legalMoves(model)[0]
    fireEvent.click(hole(m.from))
    expect(hole(m.from).dataset.sel).toBe('true')
    expect(hole(m.to).dataset.target).toBe('true')
    fireEvent.click(hole(m.to))
    expect(screen.getByText(/is thinking/)).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(THINK))
    const after = move(model, m.from, m.to)
    const ai = aiMove(after, createRandom('cc-component:0'), 'normal')!
    expect(cells()).toEqual(move(after, ai.from, ai.to).cells)
    expect(screen.getByText(/Your move/)).toBeInTheDocument()
  })

  it('cannot select the computer\'s men or move to a hole that is not highlighted', () => {
    const { hole, cells } = setup()
    const model = newGame(2)
    const theirs = model.cells.findIndex((c) => c === 2)
    fireEvent.click(hole(theirs))
    expect(hole(theirs).dataset.sel).toBeUndefined()
    const m = legalMoves(model)[0]
    fireEvent.click(hole(m.from))
    const bad = model.cells.findIndex((c, i) => c === 0 && !legalMoves(model).some((x) => x.from === m.from && x.to === i))
    fireEvent.click(hole(bad))
    expect(cells()).toEqual(model.cells)
  })

  it('reports a finished game to onFinish exactly once, even in StrictMode', () => {
    const { hole, cells, onFinish } = setup('cc-once')
    let model = newGame(2)
    const ai = createRandom('cc-once:0')
    for (let g = 0; g < TURN_LIMIT * 2 + 10 && !isOver(model); g++) {
      if (model.turn === 1) {
        const m = aiMove(model, createRandom(`h${g}`), 'normal')!
        fireEvent.click(hole(m.from))
        fireEvent.click(hole(m.to))
        model = move(model, m.from, m.to)
      } else {
        const m = aiMove(model, ai, 'normal')!
        act(() => void vi.advanceTimersByTime(THINK))
        model = move(model, m.from, m.to)
      }
      expect(cells()).toEqual(model.cells)
    }
    expect(isOver(model)).toBe(true)
    act(() => void vi.advanceTimersByTime(5000))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: model.winner === 1 })
  })

  it('switching to more players deals more men', () => {
    const { cells } = setup()
    fireEvent.change(screen.getByLabelText('Players'), { target: { value: '6' } })
    expect(cells().filter(Boolean)).toHaveLength(60)
  })
})
