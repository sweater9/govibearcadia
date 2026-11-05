import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ShotOutcome } from './carrom/rules'

// Phaser cannot run in jsdom, so the board is replaced by a stub that plays whatever outcome the test queues.
const queue: ShotOutcome[] = []
vi.mock('./carrom/board', () => ({
  mountBoard: () => ({
    sync: () => undefined,
    shoot: () => Promise.resolve(queue.shift() ?? { pocketed: [], strikerPocketed: false, positions: {} }),
    isMoving: () => false,
    destroy: () => undefined,
  }),
}))
import { Carrom } from './Carrom'

beforeEach(() => {
  localStorage.clear()
  queue.length = 0
})

async function start(label: string | RegExp = 'Pass and play') {
  fireEvent.click(screen.getByRole('button', { name: label }))
  fireEvent.click(screen.getByRole('button', { name: 'Start match' }))
  await waitFor(() => expect((screen.getByRole('button', { name: 'Strike' }) as HTMLButtonElement).disabled).toBe(false))
}

describe('Carrom', () => {
  it('passes the turn after a miss and keeps it after an own coin', async () => {
    render(<StrictMode><Carrom onFinish={() => undefined} seed="t" /></StrictMode>)
    await start()
    expect(screen.getByRole('status').textContent).toMatch(/Player 1 to shoot/)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Strike' })) })
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Player 2 to shoot/))
    queue.push({ pocketed: [2], strikerPocketed: false, positions: {} }) // seat 1 is black: id 2 is a black coin
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Strike' })) })
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/pocketed a black coin/))
    expect(screen.getByRole('status').textContent).toMatch(/Player 2 to shoot/)
  })

  it('reports the result exactly once, even in StrictMode', async () => {
    const onFinish = vi.fn()
    render(<StrictMode><Carrom onFinish={onFinish} seed="t" /></StrictMode>)
    await start()
    fireEvent.click(screen.getByRole('button', { name: 'Finish match' }))
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1))
    expect(onFinish.mock.calls[0][0]).toMatchObject({ score: 0, won: false })
    expect(onFinish.mock.calls[0][0].stats).toMatchObject({ boards: 1, players: 2 })
    await new Promise((r) => setTimeout(r, 50))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('offers to resume a saved match', async () => {
    const { unmount } = render(<Carrom onFinish={() => undefined} seed="t" />)
    await start()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Strike' })) })
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Player 2 to shoot/))
    unmount()
    render(<Carrom onFinish={() => undefined} seed="t" />)
    fireEvent.click(screen.getByRole('button', { name: 'Resume saved match' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Player 2 to shoot/))
  })
})
