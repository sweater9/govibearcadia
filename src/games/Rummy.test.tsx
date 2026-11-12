import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Rummy } from './Rummy'
import { nearlyWon } from './rummy/endgame'

beforeEach(() => localStorage.clear())

describe('Rummy', () => {
  it('shows the setup first, then deals 13 cards when the game starts', () => {
    const { container } = render(<Rummy onFinish={vi.fn()} seed="ui" />)
    expect(screen.getByRole('button', { name: 'Start game' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    expect(container.querySelectorAll('.rm-hand .rm-card')).toHaveLength(13)
    expect(screen.getByRole('button', { name: /Draw from the stock/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Declare' })).toBeDisabled()
  })

  it('drawing adds a 14th card and only an eligible discard is accepted', () => {
    const { container } = render(<Rummy onFinish={vi.fn()} seed="ui2" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    fireEvent.click(screen.getByRole('button', { name: /Draw from the stock/ }))
    expect(container.querySelectorAll('.rm-hand .rm-card')).toHaveLength(14)
    expect(screen.getByRole('button', { name: 'Discard' })).toBeDisabled()
    fireEvent.click(container.querySelector('.rm-hand .rm-card')!)
    expect(screen.getByRole('button', { name: 'Discard' })).toBeEnabled()
  })

  it('names the card you draw and marks it in your hand', () => {
    const { container } = render(<Rummy onFinish={vi.fn()} seed="ui3" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    fireEvent.click(screen.getByRole('button', { name: /Draw from the stock/ }))
    const fresh = container.querySelectorAll('.rm-hand .rm-card[data-new]')
    expect(fresh).toHaveLength(1)
    expect(fresh[0].getAttribute('aria-label')).toMatch(/just drawn/)
    expect(screen.getByRole('status')).toHaveTextContent(/You drew [A2-9JQK10]+[♠♥♦♣] from the stock/)
    expect(screen.getByRole('status')).toHaveTextContent(/You drew [A2-9JQK10]+[♠♥♦♣]\. Discard/)
  })

  it('shows every player’s running total against the pool limit', () => {
    render(<Rummy onFinish={vi.fn()} seed="ui4" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    const board = screen.getByRole('list', { name: 'Players and points' })
    expect(board).toHaveTextContent('You0/300')
    expect(board).toHaveTextContent('13 cards · 0/300')
  })

  it('carries points to the next deal instead of restarting, and reports the pool once under StrictMode', () => {
    const { seed, limit, past, actions, declare } = nearlyWon('unit-')
    localStorage.setItem('govibearcadia.rummy.v1', JSON.stringify({ players: 2, seed, limit, deals: [...past, actions], startedAt: 1, layout: declare.groups }))
    const onFinish = vi.fn()
    render(<StrictMode><Rummy onFinish={onFinish} seed={seed} /></StrictMode>)
    expect(screen.getByRole('list', { name: 'Players and points' })).toHaveTextContent(`/${limit}`)
    fireEvent.click(document.querySelector(`.rm-hand [data-card="${declare.card}"]`)!)
    fireEvent.click(screen.getByRole('button', { name: 'Declare' }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true })
    expect(screen.getByRole('button', { name: 'Play again' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(/You win the pool/)
  })
})
