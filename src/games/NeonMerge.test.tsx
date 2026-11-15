import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NeonMerge } from './NeonMerge'

// Any move ends the game with a score, like the real transition does (and like it, a finished game ignores further moves).
vi.mock('./merge/state', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./merge/state')>()),
  step: (s: { over: boolean }) => (s.over ? s : { ...s, over: true, score: 200 }),
}))

describe('NeonMerge', () => {
  it('reports a finished run exactly once under StrictMode, however many more keys are pressed', () => {
    const onFinish = vi.fn()
    render(<StrictMode><NeonMerge onFinish={onFinish} seed="t" /></StrictMode>)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    fireEvent.click(screen.getByRole('button', { name: 'Right' }))
    expect(screen.getByText('Signal lost')).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ score: 200, won: false })
  })

  it('a finished run is not reported again by Try again, but the next finished run is', () => {
    const onFinish = vi.fn()
    render(<NeonMerge onFinish={onFinish} seed="t" />)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(onFinish).toHaveBeenCalledTimes(2)
  })

  it('an abandoned run with no score is not reported, and does not finish on its own', () => {
    const onFinish = vi.fn()
    render(<NeonMerge onFinish={onFinish} seed="t" />)
    fireEvent.click(screen.getByRole('button', { name: /New game/ }))
    expect(onFinish).not.toHaveBeenCalled()
  })
})
