import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MoleMash } from './MoleMash'

// Make the first tick the end of the round, so a run finishes without waiting 45 seconds.
vi.mock('./mole/rules', async (importOriginal) => ({ ...(await importOriginal<typeof import('./mole/rules')>()), step: (s: object) => ({ ...s, status: 'over', points: 70, hits: 7, misses: 2 }) }))

describe('MoleMash', () => {
  it('reports a finished run exactly once under StrictMode', async () => {
    const onFinish = vi.fn()
    render(<StrictMode><MoleMash onFinish={onFinish} seed="u" /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(screen.getByText("Time's up!")).toBeInTheDocument())
    await new Promise((r) => setTimeout(r, 120))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ score: 70, won: false, stats: { hits: 7, misses: 2, bombs: 0 } })
  })
  it('shows the colour to whack, three lives and the streak multiplier', () => {
    render(<MoleMash onFinish={vi.fn()} seed="u" />)
    expect(screen.getByTestId('mm-target')).toHaveTextContent(/Whack (Red|Blue|Green) only/)
    expect(screen.getByTestId('mm-lives')).toHaveTextContent('♥♥♥')
    expect(screen.getByTestId('mm-mult')).toHaveTextContent('×1')
  })
  it('shows nine holes and does not finish before it is played', () => {
    const onFinish = vi.fn()
    render(<MoleMash onFinish={onFinish} seed="u" />)
    expect(screen.getAllByRole('button', { name: /^Hole \d$/ })).toHaveLength(9)
    expect(onFinish).not.toHaveBeenCalled()
  })
})
