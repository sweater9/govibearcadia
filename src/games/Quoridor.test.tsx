import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRandom } from '../lib/rng'
import { Quoridor } from './Quoridor'
import { aiMove, apply, isOver, newGame, pawnMoves, type Move, type QState } from './quoridor/rules'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const THINK = 500

function setup(seed = 'qr-component') {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <Quoridor onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const cell = (r: number, c: number) => view.container.querySelector<HTMLButtonElement>(`[data-r="${r}"][data-c="${c}"]`)!
  const pawns = () => [1, 2].map((p) => {
    const el = view.container.querySelector<HTMLElement>(`.qr-pawn[data-p="${p}"]`)!.parentElement!
    return { r: Number(el.dataset.r), c: Number(el.dataset.c) }
  })
  const walls = () => view.container.querySelectorAll('.qr-wall:not([data-preview])').length
  return { onFinish, cell, pawns, walls, view }
}

/** Plays a move with real clicks. */
function click(h: ReturnType<typeof setup>, m: Move) {
  if (m.type === 'pawn') fireEvent.click(h.cell(m.to.r, m.to.c))
  else {
    const a = () => h.view.container.querySelector<HTMLButtonElement>(`[data-anchor="${m.wall.r}-${m.wall.c}"]`)!
    if (!a()) fireEvent.click(screen.getByRole('button', { name: 'Place a wall' }))
    const wantV = m.wall.o === 'v'
    if (wantV !== /Rotate: down/.test(screen.getByRole('button', { name: 'Rotate wall' }).textContent ?? '')) fireEvent.click(screen.getByRole('button', { name: 'Rotate wall' }))
    fireEvent.click(a())
    fireEvent.click(screen.getByRole('button', { name: 'Placing walls' }))
  }
}

describe('Wall Race component', () => {
  it('steps the pawn on a highlighted square and the computer answers once, like the pure model', () => {
    const h = setup()
    fireEvent.click(h.cell(7, 4))
    expect(screen.getByText('Computer is thinking…')).toBeInTheDocument()
    act(() => void vi.advanceTimersByTime(THINK))
    let model = apply(newGame(), { type: 'pawn', to: { r: 7, c: 4 } })
    model = apply(model, aiMove(model, createRandom('qr-component:0'), 'normal')!)
    expect(h.pawns()).toEqual(model.pawns)
    expect(h.walls()).toBe(model.walls.length)
  })

  it('does not let a pawn jump to a square that is not highlighted', () => {
    const h = setup()
    expect(h.cell(5, 4)).toBeDisabled()
    expect(h.cell(7, 4)).toBeEnabled()
  })

  it('previews a wall, rotates it, and places it with the button', () => {
    const h = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Place a wall' }))
    const a = h.view.container.querySelector<HTMLButtonElement>('[data-anchor="3-3"]')!
    fireEvent.focus(a)
    expect(h.view.container.querySelector('[data-preview="ok"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Rotate wall' }))
    fireEvent.click(screen.getByRole('button', { name: 'Place wall' }))
    expect(h.walls()).toBe(1)
    expect(screen.getByText('Computer is thinking…')).toBeInTheDocument()
  })

  it('arrow keys move the pawn', () => {
    const h = setup()
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(h.pawns()[0]).toEqual({ r: 7, c: 4 })
  })

  it('two players on one screen take turns and are never scored', () => {
    const h = setup('qr-two')
    fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'two' } })
    expect(screen.getByText(/Player 1's move/)).toBeInTheDocument()
    fireEvent.click(h.cell(7, 4))
    expect(screen.getByText(/Player 2's move/)).toBeInTheDocument()
    fireEvent.click(h.cell(1, 4))
    expect(h.pawns()).toEqual([{ r: 7, c: 4 }, { r: 1, c: 4 }])
    expect(h.onFinish).not.toHaveBeenCalled()
  })

  it('reports a finished game to onFinish exactly once, even in StrictMode', () => {
    const h = setup('qr-once')
    const ai = createRandom('qr-once:0')
    let model: QState = newGame()
    for (let g = 0; g < 400 && !isOver(model); g++) {
      if (model.turn === 1) {
        // The human just runs: take the first step that shortens the way, never a wall.
        const m: Move = { type: 'pawn', to: pawnMoves(model, 1).sort((a, b) => a.r - b.r)[0] }
        click(h, m)
        model = apply(model, m)
      } else {
        const m = aiMove(model, ai, 'normal')!
        act(() => void vi.advanceTimersByTime(THINK))
        model = apply(model, m)
      }
      expect(h.pawns()).toEqual(model.pawns)
    }
    expect(isOver(model)).toBe(true)
    act(() => void vi.advanceTimersByTime(5000))
    expect(h.onFinish).toHaveBeenCalledTimes(1)
    expect(h.onFinish.mock.calls[0][0]).toMatchObject({ won: model.winner === 1 })
  })
})
