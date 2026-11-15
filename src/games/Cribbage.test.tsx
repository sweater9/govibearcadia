import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Cribbage } from './Cribbage'
import { legalCards } from './cribbage/rules'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const THINK = 650

function setup(seed = 'cb-component') {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <Cribbage onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const cards = () => [...view.container.querySelectorAll<HTMLButtonElement>('button[data-card]')]
  const tick = (ms = THINK) => act(() => void vi.advanceTimersByTime(ms))
  return { onFinish, cards, tick, view }
}

/** Plays whatever the screen asks for until the game is over, using real clicks. */
function playOut(h: ReturnType<typeof setup>) {
  for (let guard = 0; guard < 4000 && !screen.queryByRole('button', { name: 'Play again' }); guard++) {
    const send = screen.queryByRole('button', { name: /^Send to/ })
    const cont = screen.queryByRole('button', { name: /^(Continue|Next deal)$/ })
    if (send) {
      const [a, b] = h.cards()
      fireEvent.click(a)
      fireEvent.click(b)
      fireEvent.click(send)
    } else if (cont) fireEvent.click(cont)
    else {
      const playable = h.cards().find((c) => !c.disabled)
      if (playable) fireEvent.click(playable)
    }
    h.tick()
  }
}

describe('Cribbage component', () => {
  it('deals six cards and only sends the crib once exactly two are chosen', () => {
    const { cards } = setup()
    expect(cards()).toHaveLength(6)
    const send = screen.getByRole('button', { name: /^Send to/ })
    expect(send).toBeDisabled()
    fireEvent.click(cards()[0])
    expect(send).toBeDisabled()
    fireEvent.click(cards()[1])
    expect(cards()[0]).toHaveAttribute('aria-pressed', 'true')
    expect(send).toBeEnabled()
    fireEvent.click(send)
  })

  it('moves on to pegging with four cards after both discards', () => {
    const h = setup()
    fireEvent.click(h.cards()[0])
    fireEvent.click(h.cards()[1])
    fireEvent.click(screen.getByRole('button', { name: /^Send to/ }))
    h.tick(THINK * 3)
    expect(h.cards().length).toBe(4)
    expect(screen.getByText(/Count/)).toBeInTheDocument()
  })

  it('reports a finished game to onFinish exactly once, even in StrictMode', () => {
    const h = setup('cb-once')
    playOut(h)
    expect(screen.getByRole('button', { name: 'Play again' })).toBeInTheDocument()
    h.tick(10_000)
    expect(h.onFinish).toHaveBeenCalledTimes(1)
    const r = h.onFinish.mock.calls[0][0]
    expect(r.stats.you === 121 || r.stats.computer === 121).toBe(true)
    expect(r.won).toBe(r.stats.you === 121)
  })

  it('cards are buttons with readable names', () => {
    const { cards } = setup()
    expect(cards()[0].getAttribute('aria-label')).toMatch(/^(A|\d+|J|Q|K) of (spades|hearts|diamonds|clubs)/)
    expect(typeof legalCards).toBe('function')
  })
})
