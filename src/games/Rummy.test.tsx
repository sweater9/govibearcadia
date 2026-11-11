import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Rummy } from './Rummy'
import { nearlyDeclared } from './rummy/endgame'

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

  it('reports a finished run exactly once under StrictMode', () => {
    const { seed, actions, declare } = nearlyDeclared('unit-')
    localStorage.setItem('govibearcadia.rummy.v1', JSON.stringify({ players: 2, seed, actions, startedAt: 1, layout: declare.groups }))
    const onFinish = vi.fn()
    render(<StrictMode><Rummy onFinish={onFinish} seed={seed} /></StrictMode>)
    fireEvent.click(document.querySelector(`.rm-hand [data-card="${declare.card}"]`)!)
    fireEvent.click(screen.getByRole('button', { name: 'Declare' }))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true })
  })
})
