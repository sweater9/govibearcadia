import { fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorldTrip } from './WorldTrip'

describe('World Trip UI', () => {
  beforeEach(() => localStorage.clear())
  it('draws the 40 spaces and starts a match', () => {
    render(<WorldTrip onFinish={vi.fn()} seed="ui" />)
    expect(within(screen.getByRole('list', { name: 'Board in travel order' })).getAllByRole('button')).toHaveLength(40)
    fireEvent.click(screen.getByRole('button', { name: 'Start match' }))
    expect(screen.getByRole('button', { name: 'Roll dice' })).toBeVisible()
  })
  it('shows a stop card with the country when a space is selected', () => {
    render(<WorldTrip onFinish={vi.fn()} seed="ui" />)
    fireEvent.click(screen.getByRole('button', { name: /Space 4, Toronto/ }))
    expect(screen.getByRole('region', { name: 'Selected stop' })).toHaveTextContent('Canada')
  })
  it('reports once when a match finishes, even under StrictMode', () => {
    const finish = vi.fn()
    render(<StrictMode><WorldTrip onFinish={finish} seed="ui-full" /></StrictMode>)
    fireEvent.click(screen.getByLabelText('Players'))
    fireEvent.click(screen.getByRole('button', { name: 'Start match' }))
    for (let i = 0; i < 40 && !finish.mock.calls.length; i++) {
      const roll = screen.queryByRole('button', { name: 'Roll dice' })
      if (roll) fireEvent.click(roll)
      const pass = screen.queryByRole('button', { name: 'Pass' })
      if (pass) fireEvent.click(pass)
      const end = screen.queryByRole('button', { name: 'End turn' })
      if (end) fireEvent.click(end)
    }
    expect(finish).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('list', { name: 'Final standings' })).toBeVisible()
  })
})
