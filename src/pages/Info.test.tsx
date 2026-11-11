import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { About } from './About'
import { NotFound } from './NotFound'

describe('info pages', () => {
  it('not found offers a way home and asks not to be indexed', () => {
    const { unmount } = render(<MemoryRouter><NotFound /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /back to all games/i })).toHaveAttribute('href', '/')
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
    unmount()
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
  })
  it('about states what is stored and sent', () => {
    render(<MemoryRouter><About /></MemoryRouter>)
    expect(screen.getByText(/no ads, no accounts and no analytics/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Play money' })).toBeInTheDocument()
  })
})
