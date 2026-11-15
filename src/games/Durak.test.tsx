import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Durak } from './Durak'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const THINK = 650

function setup(seed = 'du-component') {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <Durak onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const cards = () => [...view.container.querySelectorAll<HTMLButtonElement>('button[data-card]')]
  const usable = () => cards().filter((c) => !c.disabled && c.closest('.du-hand'))
  const tick = (ms = THINK) => act(() => void vi.advanceTimersByTime(ms))
  return { onFinish, cards, usable, tick, view }
}

/** Does whatever the screen asks for with real clicks until the game is over. */
function playOut(h: ReturnType<typeof setup>) {
  for (let guard = 0; guard < 3000 && !screen.queryByRole('button', { name: 'Play again' }); guard++) {
    const end = screen.queryByRole('button', { name: /^(End the bout|Done adding)$/ })
    const takeBtn = screen.queryByRole('button', { name: 'Take the cards' })
    const card = h.usable()[0]
    if (card) fireEvent.click(card)
    else if (takeBtn) fireEvent.click(takeBtn)
    else if (end) fireEvent.click(end)
    h.tick()
  }
}

describe('Durak component', () => {
  it('deals six cards, shows the trump and the deck', () => {
    const { view } = setup()
    expect(view.container.querySelectorAll('.du-hand button[data-card]')).toHaveLength(6)
    expect(screen.getByText(/Deck 24/)).toBeInTheDocument()
    expect(view.container.querySelector('.du-comp')).toHaveAttribute('aria-label', 'Computer holds 6 cards')
  })

  it('only glowing cards can be played, and playing one changes the table', () => {
    const h = setup('du-start')
    h.tick(THINK * 3)
    const ids = () => h.cards().map((c) => c.dataset.card).join(',')
    const playable = h.usable()
    expect(playable.length).toBeGreaterThan(0)
    for (const c of h.cards().filter((x) => x.closest('.du-hand') && !playable.includes(x))) expect(c).toBeDisabled()
    const before = ids()
    fireEvent.click(playable[0])
    expect(ids()).not.toBe(before)
  })

  it('reports a finished game to onFinish exactly once, even in StrictMode', () => {
    const h = setup('du-once')
    playOut(h)
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
    h.tick(10_000)
    expect(h.onFinish).toHaveBeenCalledTimes(1)
    const r = h.onFinish.mock.calls[0][0]
    expect(typeof r.score).toBe('number')
    expect(r.won).toBe(r.stats.cardsLeft === 0 && r.stats.opponentCards > 0)
  })

  it('cards are buttons with readable names', () => {
    const { cards } = setup()
    expect(cards()[0].getAttribute('aria-label')).toMatch(/^(6|7|8|9|10|J|Q|K|A) of (spades|hearts|diamonds|clubs)/)
  })
})
