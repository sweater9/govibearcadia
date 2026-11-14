import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StackTower } from './StackTower'

// A drop always misses, so the first real drop ends the run.
vi.mock('./stack/rules', async (importOriginal) => {
  const real = await importOriginal<typeof import('./stack/rules')>()
  return { ...real, drop: (s: { status: string }) => (s.status === 'ready' ? real.drop(s as never) : { ...s, status: 'over' }) }
})

describe('StackTower', () => {
  it('reports a finished run exactly once under StrictMode', () => {
    const onFinish = vi.fn()
    render(<StrictMode><StackTower onFinish={onFinish} seed="u" /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Drop block' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Drop block' }))
    expect(screen.getByText('Tower fell!')).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: false, stats: { floors: 0 } })
  })
  it('does not finish before the first drop', () => {
    const onFinish = vi.fn()
    render(<StackTower onFinish={onFinish} seed="u" />)
    fireEvent.keyDown(window, { key: 'x' })
    expect(onFinish).not.toHaveBeenCalled()
  })
})
