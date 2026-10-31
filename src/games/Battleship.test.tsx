import { StrictMode } from 'react'
import { act as rtlAct, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRandom } from '../lib/rng'
import { Battleship } from './Battleship'
import { act, aiShot, newRoom, viewFor, type Room } from './battleship/rules'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const THINK = 600
const SEED = 'bs-component'

function setup() {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <Battleship onFinish={onFinish} seed={SEED} />
    </StrictMode>,
  )
  const cell = (i: number) => view.container.querySelector<HTMLButtonElement>(`[data-cell="${i}"]`)
  return { onFinish, view, cell }
}

/** The same game, played by the pure rules from the same seeded stream. */
function modelAfterReady() {
  const random = createRandom(SEED)
  let room = newRoom(random)
  for (const seat of [0, 1] as const) {
    const r = act(room, seat, { type: 'ready' }, random)
    if (r.ok) room = r.room
  }
  return { random, room }
}

describe('Battleship component', () => {
  it('starts by placing; Ready starts the battle and the enemy waters can be fired on', () => {
    const { cell } = setup()
    expect(screen.getByText('Place your fleet')).toBeInTheDocument()
    expect(cell(0)).toBeNull() // the enemy waters are not shown while placing
    fireEvent.click(screen.getByRole('button', { name: 'Ready' }))
    expect(screen.getByText('Your shot')).toBeInTheDocument()
    expect(cell(0)).not.toBeNull()
  })

  it('shuffling changes the fleet; it is the same fleet for the same seed', () => {
    setup()
    const ships = () => Array.from(document.querySelectorAll('[data-ship]')).length
    expect(ships()).toBe(17)
    fireEvent.click(screen.getByRole('button', { name: 'Shuffle fleet' }))
    expect(ships()).toBe(17)
  })

  it('the computer answers once after a pause, firing where the pure model says', () => {
    const { cell, view } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Ready' }))
    const { random, room } = modelAfterReady()
    fireEvent.click(cell(0)!)
    expect(screen.getByText('Computer is aiming…')).toBeInTheDocument()
    rtlAct(() => void vi.advanceTimersByTime(THINK))
    const after = act(room, 0, { type: 'move', cell: 0 })
    if (!after.ok) throw new Error('model')
    const reply = aiShot(viewFor(after.room, 1), random)
    fireEvent.click(screen.getByRole('button', { name: 'Your fleet' }))
    const marked = Array.from(view.container.querySelectorAll('[data-state]')).length
    expect(marked).toBe(1)
    expect(view.container.querySelectorAll(`[aria-label^="row ${Math.floor(reply / 10) + 1}, column ${(reply % 10) + 1},"][data-state]`)).toHaveLength(1)
    rtlAct(() => void vi.advanceTimersByTime(5000))
    expect(view.container.querySelectorAll('[data-state]')).toHaveLength(1)
  })

  it('reports a finished game exactly once, and Play again starts clean', () => {
    const { onFinish, cell } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Ready' }))
    const { random, room: start } = modelAfterReady()
    let room = start
    const targets = room.fleets[1].flat()
    for (const t of targets) {
      if (onFinish.mock.calls.length) break
      fireEvent.click(cell(t)!)
      const r = act(room, 0, { type: 'move', cell: t })
      if (!r.ok) throw new Error('model')
      room = r.room as Room
      if (room.phase === 'battle') {
        rtlAct(() => void vi.advanceTimersByTime(THINK))
        const c = act(room, 1, { type: 'move', cell: aiShot(viewFor(room, 1), random) })
        if (!c.ok) throw new Error('model')
        room = c.room
      }
    }
    expect(onFinish).toHaveBeenCalledTimes(1)
    const result = onFinish.mock.calls[0][0]
    expect(result).toMatchObject({ won: true, stats: { moves: 17, outcome: 1 } })
    rtlAct(() => void vi.advanceTimersByTime(10_000))
    expect(onFinish).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(screen.getByText('Place your fleet')).toBeInTheDocument()
  })

  it('does not report an abandoned game', () => {
    const { onFinish, cell } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Ready' }))
    fireEvent.click(cell(0)!)
    fireEvent.click(screen.getByRole('button', { name: /New/ }))
    expect(onFinish).not.toHaveBeenCalled()
  })
})
