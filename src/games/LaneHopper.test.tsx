import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LaneHopper } from './LaneHopper'

// Make the first tick a death, so a run ends without waiting on real traffic.
vi.mock('./hopper/rules', async (importOriginal) => ({ ...(await importOriginal<typeof import('./hopper/rules')>()), step: (s: { status: string }) => ({ ...s, status: 'dead', cause: 'car', best: 4 }) }))

describe('LaneHopper', () => {
  it('reports a finished run exactly once under StrictMode', async () => {
    const onFinish = vi.fn()
    render(<StrictMode><LaneHopper onFinish={onFinish} seed="u" /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(screen.getByText('Squashed!')).toBeInTheDocument())
    await new Promise((r) => setTimeout(r, 120))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ score: 4, won: false, stats: { rows: 4, eagle: 0 } })
  })
  it('hops with the arrow keys and the pad, and does not finish on its own', () => {
    const onFinish = vi.fn()
    render(<LaneHopper onFinish={onFinish} seed="u" />)
    expect(screen.getByRole('img', { name: /row 0, column 4/ })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('img', { name: /row 0, column 5/ })).toBeInTheDocument()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Hop left' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Hop left' }))
    expect(screen.getByRole('img', { name: /row 0, column 3/ })).toBeInTheDocument()
    expect(onFinish).not.toHaveBeenCalled()
  })
})
