import { fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AaduPuliAttam } from './AaduPuliAttam'

describe('Aadu Puli Attam UI', () => {
  beforeEach(() => localStorage.clear())
  it('renders 23 keyboard-accessible points and places a goat', () => {
    render(<AaduPuliAttam onFinish={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: /point/i })).toHaveLength(23)
    fireEvent.click(screen.getByRole('button', { name: 'Empty point 2' }))
    expect(screen.getByRole('button', { name: 'Goat at point 2' })).toBeVisible()
  })
  it('does not report an unfinished run under StrictMode', () => {
    const finish = vi.fn(); render(<StrictMode><AaduPuliAttam onFinish={finish} /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Empty point 2' })); expect(finish).not.toHaveBeenCalled()
  })
  it('restores an unfinished local match', () => {
    const { unmount } = render(<AaduPuliAttam onFinish={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'local' } }); fireEvent.click(screen.getByRole('button', { name: 'Empty point 2' })); unmount()
    render(<AaduPuliAttam onFinish={vi.fn()} />)
    expect(screen.getByLabelText('Mode')).toHaveValue('local'); expect(screen.getByRole('button', { name: 'Goat at point 2' })).toBeVisible()
  })
  it('offers rule choices, restarts on change and restores Standard rules', () => {
    render(<AaduPuliAttam onFinish={vi.fn()} />)
    expect(screen.getByText('Rules: standard')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Captures to win'), { target: { value: '6' } })
    expect(screen.getByText('Rules: custom')).toBeInTheDocument()
    expect(screen.getByText('0/6')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Standard rules' }))
    expect(screen.getByText('0/5')).toBeInTheDocument()
  })
  it('lets tigers move first when chosen (the computer then plays tigers)', () => {
    render(<AaduPuliAttam onFinish={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Moves first'), { target: { value: 'tigers' } })
    expect(screen.getByText('Computer is thinking…')).toBeInTheDocument()
  })
})
