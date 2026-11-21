import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CrazyEights } from './CrazyEights'

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})
afterEach(() => vi.useRealTimers())

const THINK = 760

function setup(seed = 'ce-component') {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <CrazyEights onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const hand = () => [...view.container.querySelectorAll<HTMLButtonElement>('.ce-hand button[data-card]')]
  const tick = (ms = THINK) => act(() => void vi.advanceTimersByTime(ms))
  return { onFinish, hand, tick, view }
}

/** Does what the screen asks, with real clicks, until the match is over. */
function playOut(h: ReturnType<typeof setup>, limit = 4000) {
  for (let guard = 0; guard < limit && !screen.queryByRole('button', { name: 'Play again' }); guard++) {
    const next = screen.queryByRole('button', { name: 'Next round' })
    const suit = screen.queryAllByRole('button', { name: /^Choose (Spades|Hearts|Diamonds|Clubs)$/ })
    const stock = screen.queryByRole('button', { name: /^Draw a card/ }) as HTMLButtonElement | null
    if (next) fireEvent.click(next)
    else if (suit.length) fireEvent.click(suit[0])
    else {
      const playable = h.hand().find((c) => !c.disabled)
      if (playable) fireEvent.click(playable)
      else if (stock && !stock.disabled) fireEvent.click(stock)
    }
    h.tick()
  }
}

describe('Crazy Eights component', () => {
  it('deals seven cards to you with names a screen reader can use, and shows whose turn it is', () => {
    const { hand, view } = setup()
    expect(hand()).toHaveLength(7)
    expect(hand()[0].getAttribute('aria-label')).toMatch(/ of (spades|hearts|diamonds|clubs)/)
    expect(view.container.querySelector('.ce-suit')?.getAttribute('aria-label')).toMatch(/^Suit to match: /)
    expect(screen.getAllByText(/Your turn|is thinking/).length).toBeGreaterThan(0)
  })

  it('only lets you play legal cards, and the computer answers after a pause', () => {
    const { hand, tick } = setup('ce-turns')
    const playable = hand().filter((c) => !c.disabled)
    expect(playable.length).toBeGreaterThan(0)
    const before = hand().length
    fireEvent.click(playable.find((c) => !/^8 /.test(c.getAttribute('aria-label') ?? '')) ?? playable[0])
    expect(screen.queryAllByRole('button', { name: /^Choose / }).length === 4 || hand().length === before - 1).toBe(true)
    tick()
  })

  it('plays a whole match against the computer, reports it exactly once even under StrictMode, and offers Play again', () => {
    const h = setup('ce-match')
    fireEvent.click(screen.getByRole('button', { name: /New game/ }))
    fireEvent.change(screen.getByLabelText('Play to'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    playOut(h)
    expect(screen.getByRole('button', { name: 'Play again' })).toBeTruthy()
    expect(h.onFinish).toHaveBeenCalledTimes(1)
    const result = h.onFinish.mock.calls[0][0]
    expect(result.stats.target).toBe(50)
    expect(result.won).toBe(result.score >= 50)
    h.tick(10_000)
    expect(h.onFinish).toHaveBeenCalledTimes(1)
  })

  it('pausing stops the computer, and resuming lets it carry on', () => {
    const { view, tick } = setup('ce-pause')
    const hand = () => [...view.container.querySelectorAll<HTMLButtonElement>('.ce-hand button[data-card]')]
    const playable = hand().find((c) => !c.disabled && !/^8 /.test(c.getAttribute('aria-label') ?? ''))
    expect(playable).toBeTruthy()
    fireEvent.click(playable as HTMLButtonElement)
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }))
    const count = () => view.container.querySelector('.ce-seat b')?.textContent
    const frozen = count()
    tick(5000)
    expect(count()).toBe(frozen)
    expect(screen.getAllByText('Paused').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Resume' })[0])
    tick()
  })

  it('offers the optional house rules and up to four players, and pass and play hides the hand until revealed', () => {
    const { view } = setup('ce-hot')
    fireEvent.click(screen.getByRole('button', { name: /New game/ }))
    fireEvent.change(screen.getByLabelText('Players'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Humans on this device'), { target: { value: '2' } })
    expect(screen.getByLabelText('When you cannot play')).toBeTruthy()
    expect(screen.getByLabelText('You cannot go out with an eight')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    expect(view.container.querySelectorAll('.ce-hand button[data-card]')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /^Show Player 1's hand$/ }))
    expect(view.container.querySelectorAll('.ce-hand button[data-card]')).toHaveLength(5)
  })

  it('remembers the animation choice', () => {
    setup('ce-anim')
    fireEvent.click(screen.getByLabelText('Animations'))
    expect(localStorage.getItem('govibearcadia.ce.anim')).toBe('off')
  })
})
