import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GhataBara } from './GhataBara'
import { innerKey, newGame, type State } from './ghata/rules'

const KEY = 'govibearcadia.ghata'
const store = (state: State, humans = 1) => localStorage.setItem(KEY, JSON.stringify({ v: 1, seed: 'unit', draws: 0, humans, state }))

/** Five pawns home and the sixth three squares from Home, with a 3 to play: one move wins. */
function almostWon(): State {
  const s = newGame()
  s.phase = 'move'
  s.queue = [3]
  for (let id = 0; id < 5; id++) s.pawns[id].where = 'home'
  Object.assign(s.pawns[5], { where: 'inner', at: 5, credit: true })
  s.entered[0] = true
  return s
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

describe('GhataBara', () => {
  it('shows the 7x7 board with its 13 X squares, four seats and a Roll button', () => {
    const { container } = render(<GhataBara onFinish={vi.fn()} seed="ui" />)
    expect(container.querySelectorAll('.gb-sq')).toHaveLength(49)
    expect(container.querySelectorAll('.gb-sq[data-safe]')).toHaveLength(13)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Roll' })).toBeEnabled()
  })

  it('the 5x5 board is still available, with its five X squares', () => {
    const { container } = render(<GhataBara onFinish={vi.fn()} seed="ui" />)
    fireEvent.change(screen.getByLabelText('Board size'), { target: { value: '5' } })
    expect(container.querySelectorAll('.gb-sq')).toHaveLength(25)
    expect(container.querySelectorAll('.gb-sq[data-safe]')).toHaveLength(5)
  })

  it('reports a finished run exactly once under StrictMode, and clears the saved game', () => {
    store(almostWon())
    const onFinish = vi.fn()
    const { container } = render(
      <StrictMode>
        <GhataBara onFinish={onFinish} />
      </StrictMode>,
    )
    fireEvent.click(container.querySelector(`[data-square="${innerKey(0, 5)}"]`)!) // pick the pawn
    fireEvent.click(container.querySelector('[data-square="c"]')!) // move Home
    expect(screen.getByRole('status')).toHaveTextContent('Violet wins!')
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true, score: 100 * 6 + 400 })
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('only a legal destination is clickable, and Escape drops the selection', () => {
    store(almostWon())
    const { container } = render(<GhataBara onFinish={vi.fn()} />)
    const home = container.querySelector<HTMLButtonElement>('[data-square="c"]')!
    expect(home).toBeDisabled()
    fireEvent.click(container.querySelector(`[data-square="${innerKey(0, 5)}"]`)!)
    expect(home).toBeEnabled()
    expect(home).toHaveTextContent('3')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(home).toBeDisabled()
  })

  it('computer players move on their own after a pause', () => {
    vi.useFakeTimers()
    const s = newGame()
    s.turn = 1
    store(s)
    render(<GhataBara onFinish={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Cyan: rolling')
    act(() => void vi.advanceTimersByTime(400))
    expect(screen.getByRole('status')).toHaveTextContent('Cyan rolled')
  })

  it('resumes a saved game and ignores a damaged save', () => {
    const s = newGame()
    s.turn = 2
    store(s, 2)
    const first = render(<GhataBara onFinish={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('saved game was restored')
    first.unmount()
    localStorage.setItem(KEY, '{"v":1,"seed":7}')
    render(<GhataBara onFinish={vi.fn()} />)
    expect(screen.getByRole('status')).not.toHaveTextContent('restored')
  })

  it('with two people on one screen it asks to pass the device before the next person rolls', () => {
    vi.useFakeTimers()
    const s = newGame()
    s.turn = 1 // the computer's seat, between the two people (Violet and Amber)
    store(s, 2)
    render(<GhataBara onFinish={vi.fn()} />)
    for (let i = 0; i < 200 && !screen.queryByRole('dialog'); i++) act(() => void vi.advanceTimersByTime(400))
    expect(screen.getByRole('dialog', { name: 'Pass the device' })).toHaveTextContent('Amber')
    expect(screen.getByRole('button', { name: 'Roll' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Amber is ready' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Roll' })).toBeEnabled()
  })

  it('lets a player choose a piece, never the same as another seat, and remembers it', () => {
    const { container } = render(<GhataBara onFinish={vi.fn()} seed="ui" />)
    fireEvent.change(screen.getByLabelText('Players'), { target: { value: '2' } })
    fireEvent.click(screen.getAllByRole('button', { name: /^Piece:/ })[0])
    const group = screen.getByRole('radiogroup', { name: 'Piece for Violet' })
    expect(group.querySelectorAll('button')).toHaveLength(8)
    expect(screen.getByRole('radio', { name: 'Rocket, taken' })).toBeDisabled() // Amber already holds it
    fireEvent.click(screen.getByRole('radio', { name: 'Star' }))
    expect(screen.getAllByRole('button', { name: /^Piece:/ })[0]).toHaveTextContent('Piece: Star')
    expect(localStorage.getItem('govibearcadia.ghata.token')).toBe('4')
    // Amber (the second person) cannot take it
    fireEvent.click(screen.getAllByRole('button', { name: /^Piece:/ })[1])
    expect(screen.getByRole('radio', { name: 'Star, taken' })).toBeDisabled()
    expect(container.querySelectorAll('.gb-seats svg')).toHaveLength(4)
  })
})
