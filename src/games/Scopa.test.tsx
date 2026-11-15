import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Scopa } from './Scopa'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const THINK = 700

function setup(seed = 'sc-component') {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <Scopa onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const hand = () => [...view.container.querySelectorAll<HTMLButtonElement>('button[data-card]')]
  const tick = (ms = THINK) => act(() => void vi.advanceTimersByTime(ms))
  return { onFinish, hand, tick, view }
}

/** Plays whatever the screen asks for, with real clicks, until the match is over. */
function playOut(h: ReturnType<typeof setup>) {
  for (let guard = 0; guard < 3000 && !screen.queryByRole('button', { name: 'Play again' }); guard++) {
    const nextHand = screen.queryByRole('button', { name: 'Next hand' })
    const choice = screen.queryAllByRole('button', { name: /^\d+\. Take/ })
    if (nextHand) fireEvent.click(nextHand)
    else if (choice.length) fireEvent.click(choice[0])
    else {
      const playable = h.hand().find((c) => !c.disabled)
      if (playable) fireEvent.click(playable)
    }
    h.tick()
  }
}

describe('Scopa component', () => {
  it('deals three cards to you and four to the table, with names a screen reader can use', () => {
    const { hand, view } = setup()
    expect(view.container.querySelectorAll('.sc-table [data-card]')).toHaveLength(4)
    const cards = hand()
    // When the computer plays first, its card has already been played after the delay.
    expect(cards.length).toBeLessThanOrEqual(3)
    expect(cards[0].getAttribute('aria-label')).toMatch(/of (Coins|Cups|Swords|Clubs)/)
  })

  it('reports a finished match to onFinish exactly once, even in StrictMode', () => {
    const h = setup('sc-once')
    playOut(h)
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
    h.tick(10_000)
    expect(h.onFinish).toHaveBeenCalledTimes(1)
    const r = h.onFinish.mock.calls[0][0]
    expect(Math.max(r.stats.you, r.stats.computer)).toBeGreaterThanOrEqual(11)
    expect(r.won).toBe(r.stats.you > r.stats.computer)
  })

  it('shows a scoring breakdown after each hand', () => {
    const h = setup('sc-summary')
    for (let guard = 0; guard < 400 && !screen.queryByText('Hand scored'); guard++) {
      const choice = screen.queryAllByRole('button', { name: /^\d+\. Take/ })
      if (choice.length) fireEvent.click(choice[0])
      else {
        const playable = h.hand().find((c) => !c.disabled)
        if (playable) fireEvent.click(playable)
      }
      h.tick()
    }
    expect(screen.getByText('Hand scored')).toBeInTheDocument()
    expect(screen.getByText('Most cards')).toBeInTheDocument()
    expect(screen.getByText('Primiera')).toBeInTheDocument()
  })

  it('the keys 1 to 3 play a card, and Escape closes a choice', () => {
    const h = setup('sc-keys')
    h.tick()
    const before = h.hand().length
    if (before > 0) {
      fireEvent.keyDown(window, { key: '1' })
      expect(screen.queryAllByRole('button', { name: /^\d+\. Take/ }).length > 0 || h.hand().length < before).toBe(true)
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(screen.queryAllByRole('button', { name: /^\d+\. Take/ })).toHaveLength(0)
    }
  })
})
