import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { GAME_INFO } from '../games/info'
import type { GameMeta } from '../types'
import { HowToPlay } from './HowToPlay'

const meta = { id: 'hangman', title: 'Hangman', description: 'd', category: 'Word', accent: '', glyph: 'H', estimated: '3 min' } as unknown as GameMeta
beforeEach(() => localStorage.clear())

describe('HowToPlay', () => {
  it('shows a new marker, opens the rules, and remembers it was opened', () => {
    const { unmount } = render(<HowToPlay meta={meta} />)
    fireEvent.click(screen.getByRole('button', { name: 'How to play (new)' }))
    const dialog = screen.getByRole('dialog', { name: 'How to play Hangman' })
    expect(dialog.textContent).toContain(GAME_INFO.hangman.how)
    unmount()
    render(<HowToPlay meta={meta} />)
    expect(screen.getByRole('button', { name: 'How to play' })).toBeTruthy()
  })
  it('does not open by itself', () => {
    render(<HowToPlay meta={meta} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('closes with Escape, the close button and Got it, and moves focus back', () => {
    render(<HowToPlay meta={meta} />)
    const opener = screen.getByRole('button', { name: /How to play/ })
    for (const close of [() => fireEvent.keyDown(window, { key: 'Escape' }), () => fireEvent.click(screen.getByRole('button', { name: 'Close' })), () => fireEvent.click(screen.getByRole('button', { name: 'Got it' }))]) {
      fireEvent.click(opener)
      expect(screen.getByRole('dialog')).toBeTruthy()
      close()
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(document.activeElement).toBe(opener)
    }
  })
  it('works for every game that has no entry by falling back to the description', () => {
    render(<HowToPlay meta={{ ...meta, id: 'nope', description: 'Fallback text' }} />)
    fireEvent.click(screen.getByRole('button', { name: /How to play/ }))
    expect(screen.getByText('Fallback text')).toBeTruthy()
  })
})
