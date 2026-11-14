import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { State } from './callbreak/rules'
import { CallBreak } from './CallBreak'

const c = (suit: number, rank: number) => suit * 13 + rank
// The last card of the last round: you hold the ace of spades, the other three have played theirs.
const lastCard: State = {
  seed: 'x', round: 4, dealer: 0, phase: 'play', turn: 0,
  hands: [[c(0, 0)], [], [], []], bids: [2, 3, 3, 2], tricks: [1, 1, 1, 1],
  trick: [{ player: 1, card: c(1, 5) }, { player: 2, card: c(1, 8) }, { player: 3, card: c(1, 2) }], last: null,
  history: [[20, 30, -30, 20], [20, -30, 31, 20], [-20, 30, 30, 20], [20, 30, 30, -20]],
}
vi.mock('./callbreak/rules', async (importOriginal) => ({ ...(await importOriginal<typeof import('./callbreak/rules')>()), newGame: () => lastCard }))

describe('CallBreak', () => {
  it('reports the finished game exactly once under StrictMode', () => {
    const onFinish = vi.fn()
    render(<StrictMode><CallBreak onFinish={onFinish} seed="x" /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Ace of spades' }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ stats: { rounds: 5 } })
    expect(screen.getByRole('button', { name: 'New game' })).toBeInTheDocument()
  })
  it('only lets you play a legal card', () => {
    render(<CallBreak onFinish={() => {}} seed="x" />)
    expect(screen.getByRole('button', { name: 'Ace of spades' })).toBeEnabled()
  })
})
