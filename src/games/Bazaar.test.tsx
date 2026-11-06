import { fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { expect, it, vi } from 'vitest'
import { Bazaar } from './Bazaar'
import { ROUNDS } from './bazaar/rules'

it('reports a completed match only once, including after reopening it', () => {
  const finish = vi.fn()
  const game = <StrictMode><Bazaar seed="finish-test" onFinish={finish} /></StrictMode>
  const { unmount } = render(game)
  fireEvent.click(screen.getByRole('button', { name: 'Start match' }))
  for (let turn = 0; turn < ROUNDS * 2; turn++) {
    fireEvent.click(screen.getByRole('button', { name: 'Roll dice' }))
    const pass = screen.queryByRole('button', { name: 'Pass on purchase' })
    if (pass) fireEvent.click(pass)
    fireEvent.click(screen.getByRole('button', { name: 'End turn' }))
  }
  expect(finish).toHaveBeenCalledTimes(1)
  unmount()
  render(game)
  expect(screen.getByRole('list', { name: 'Final standings' })).toBeVisible()
  expect(finish).toHaveBeenCalledTimes(1)
})
