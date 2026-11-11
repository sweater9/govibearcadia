import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Blackjack } from './Blackjack'

const db = vi.hoisted(() => ({ stake: 1000, saved: [] as number[] }))
vi.mock('../lib/db', () => ({ blackjackStake: async () => db.stake, saveBankroll: async (n: number) => { db.saved.push(n) } }))

beforeEach(() => {
  localStorage.clear()
  db.stake = 1000
  db.saved = []
})

describe('Blackjack', () => {
  it('asks to start, then shows 1000 chips and a Deal button', async () => {
    render(<Blackjack onFinish={vi.fn()} seed="ui" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    expect(await screen.findByRole('button', { name: 'Deal' })).toBeEnabled()
    expect(screen.getAllByText('1000').length).toBeGreaterThan(0)
  })

  it('dealing gives two cards each, the dealer hole card stays face down, and the saved session resumes', async () => {
    const { container, unmount } = render(<Blackjack onFinish={vi.fn()} seed="ui2" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Deal' }))
    const playing = !!screen.queryByRole('button', { name: 'Hit' })
    expect(container.querySelectorAll('.bj-seat[aria-label="Your hands"] .bj-card')).toHaveLength(2)
    if (playing) expect(container.querySelectorAll('.bj-hole')).toHaveLength(1)
    unmount()
    const again = render(<Blackjack onFinish={vi.fn()} seed="ui2" />)
    expect(again.container.querySelectorAll('.bj-seat[aria-label="Your hands"] .bj-card')).toHaveLength(2)
  })

  it('reports a finished session exactly once under StrictMode when you cash out', async () => {
    const onFinish = vi.fn()
    render(<StrictMode><Blackjack onFinish={onFinish} seed="ui3" /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cash out' }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ score: 1000, won: false })
  })

  it('starts from the carried-over bankroll and saves what you cash out with', async () => {
    db.stake = 2500
    const onFinish = vi.fn()
    render(<Blackjack onFinish={onFinish} seed="ui4" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cash out' }))
    expect(onFinish.mock.calls[0][0]).toMatchObject({ score: 2500, won: false })
    expect(db.saved).toEqual([2500])
  })
})
