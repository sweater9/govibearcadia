import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRandom } from '../lib/rng'
import { Mahjong } from './Mahjong'
import { newMatch } from './mahjong/rules'

beforeEach(() => localStorage.clear())

const startSingle = () => {
  fireEvent.change(screen.getByLabelText('Length'), { target: { value: 'single' } })
  fireEvent.click(screen.getByRole('button', { name: 'Start' }))
}

describe('Taiwanese Mahjong', () => {
  it('deals you 16 tiles and, as dealer, a 17th you drew', () => {
    render(<Mahjong onFinish={vi.fn()} seed="ui" />)
    startSingle()
    const hand = screen.getByTestId('mj-hand')
    expect(hand.querySelectorAll('.mj-tile')).toHaveLength(17)
    expect(screen.getByText(/Your turn/)).toBeInTheDocument()
  })

  it('tap once to pick a tile and again to discard it; the computers then play', async () => {
    render(<Mahjong onFinish={vi.fn()} seed="ui" />)
    startSingle()
    const first = screen.getByTestId('mj-hand').querySelector('button')!
    fireEvent.click(first)
    expect(first).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('mj-pool').querySelectorAll('.mj-tile')).toHaveLength(0)
    fireEvent.click(first)
    expect(screen.getByTestId('mj-pool').querySelectorAll('.mj-tile')).toHaveLength(1)
    await waitFor(() => expect(screen.getByTestId('mj-pool').querySelectorAll('.mj-tile').length).toBeGreaterThan(1), { timeout: 4000 })
  })

  it('reports the result exactly once when the match ends, even in StrictMode', async () => {
    const s = newMatch(createRandom('fin'), { match: 'single' })
    s.seats[0].hand = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 18, 18]
    s.drawn = 18
    s.turn = 0
    s.dealer = 0
    localStorage.setItem('govibearcadia.mahjong', JSON.stringify({ v: 1, level: 'medium', startedAt: Date.now(), state: s, seed: 'fin' }))
    const onFinish = vi.fn()
    render(<StrictMode><Mahjong onFinish={onFinish} /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Resume saved game' }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^Win \(/ })) })
    await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1))
    const r = onFinish.mock.calls[0][0]
    expect(r.won).toBe(true)
    expect(r.score).toBeGreaterThan(1000)
    expect(r.stats).toMatchObject({ hands: 1, handsWon: 1 })
    await new Promise((x) => setTimeout(x, 50))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog', { name: 'Hand result' })).toHaveTextContent('You wins')
  })

  it('offers the scoring table', () => {
    render(<Mahjong onFinish={vi.fn()} seed="ui" />)
    startSingle()
    fireEvent.click(screen.getByRole('button', { name: 'Scoring' }))
    expect(screen.getByRole('dialog', { name: 'Scoring' })).toHaveTextContent(/all pungs 4/i)
  })
})

describe('rule choices', () => {
  it('starts on the standard rules and Standard rules restores them', () => {
    render(<Mahjong onFinish={() => {}} />)
    const std = screen.getByRole('button', { name: 'Standard rules' })
    expect(std).toBeDisabled()
    fireEvent.change(screen.getByLabelText('To win'), { target: { value: '3' } })
    expect(std).toBeEnabled()
    fireEvent.click(std)
    expect(screen.getByLabelText('To win')).toHaveValue('0')
  })
  it('remembers the last chosen rules', () => {
    const { unmount } = render(<Mahjong onFinish={() => {}} />)
    fireEvent.change(screen.getByLabelText('Dealer bonus'), { target: { value: 'none' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    unmount()
    render(<Mahjong onFinish={() => {}} />)
    expect(screen.getByLabelText('Dealer bonus')).toHaveValue('none')
  })
})
