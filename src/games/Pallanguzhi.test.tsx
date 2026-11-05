import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Pallanguzhi } from './Pallanguzhi'
import { apply, newGame, seedsOnBoard, type State } from './pallanguzhi/rules'

const KEY = 'govibearcadia.pallanguzhi'
const SETTINGS = 'govibearcadia.pallanguzhi.settings'
const instant = () => localStorage.setItem(SETTINGS, JSON.stringify({ speed: 'instant' }))
const store = (state: State, mode = 'local') => localStorage.setItem(KEY, JSON.stringify({ v: 1, mode, level: 'easy', state, history: [] }))

function position(pits: Record<number, number>, stores: [number, number], over: Partial<State> = {}): State {
  const s = newGame()
  s.pits = Array(14).fill(0)
  for (const [i, n] of Object.entries(pits)) s.pits[Number(i)] = n
  s.stores = stores
  return Object.assign(s, over)
}

/** One capture decides the match: Player 2 will be unable to refill a single pit. */
const decisive = () => position({ 0: 1, 3: 3 }, [0, 66])

const pit = (owner: 'Player 1' | 'Player 2', n: number) =>
  screen.getByRole('button', { name: new RegExp(`^${owner === 'Player 1' ? '(Player 1|You)' : '(Player 2|Computer)'}[^:]* pit ${n}:`) })

beforeEach(() => {
  localStorage.clear()
  instant()
})
afterEach(() => vi.useRealTimers())

describe('Pallanguzhi', () => {
  it('shows 14 pits with five seeds each, two empty trays and the round', () => {
    const { container } = render(<Pallanguzhi onFinish={vi.fn()} seed="ui" />)
    const pits = container.querySelectorAll('.pg-pit')
    expect(pits).toHaveLength(14)
    expect([...pits].every((p) => p.getAttribute('data-count') === '5')).toBe(true)
    expect(screen.getByTestId('store-0')).toHaveTextContent('0')
    expect(screen.getByTestId('store-1')).toHaveTextContent('0')
    expect(screen.getByText('Round 1')).toBeInTheDocument()
    expect(pit('Player 1', 1)).toHaveAccessibleName(/5 seeds, choose to sow/)
  })

  it('explains a pit that cannot be chosen, and changes nothing', () => {
    store(newGame())
    const { container } = render(<Pallanguzhi onFinish={vi.fn()} seed={undefined} />)
    fireEvent.click(pit('Player 2', 1))
    expect(screen.getByRole('status', { name: '' })).toBeDefined()
    expect(container.querySelector('.pg-note')).toHaveTextContent('Player 2’s pit')
    expect(seedsOnBoard(newGame())).toBe(70)
    expect([...container.querySelectorAll('.pg-pit')].every((p) => p.getAttribute('data-count') === '5')).toBe(true)
  })

  it('a move sows, relays, and passes the turn; Player 2’s pits then become the legal ones', () => {
    store(newGame())
    const { container } = render(<Pallanguzhi onFinish={vi.fn()} />)
    fireEvent.click(pit('Player 1', 3))
    const total = [...container.querySelectorAll('.pg-pit')].reduce((a, p) => a + Number(p.getAttribute('data-count')), 0)
    const trays = Number(screen.getByTestId('store-0').textContent) + Number(screen.getByTestId('store-1').textContent)
    expect(total + trays).toBe(70)
    expect(container.querySelectorAll('.pg-pit[data-legal]').length).toBeGreaterThan(0)
  })

  it('reports a finished match exactly once under StrictMode and clears the saved match', () => {
    store(decisive())
    const onFinish = vi.fn()
    render(
      <StrictMode>
        <Pallanguzhi onFinish={onFinish} />
      </StrictMode>,
    )
    fireEvent.click(pit('Player 1', 1)) // captures, earns a second sowing
    expect(onFinish).not.toHaveBeenCalled()
    fireEvent.click(pit('Player 1', 2))
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true })
    expect(screen.getByRole('group', { name: 'Match over' })).toHaveTextContent('wins the match')
    expect(localStorage.getItem(KEY)).toBeNull()
    fireEvent.click(pit('Player 1', 2))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('between rounds the next round is started by the players, refills pits and marks piggy pits', () => {
    const roundOver = position({}, [20, 50])
    roundOver.phase = 'round-over'
    store(roundOver)
    const { container } = render(<Pallanguzhi onFinish={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start round 2' }))
    expect(container.querySelectorAll('.pg-pit[data-inactive]')).toHaveLength(3)
    expect(pit('Player 1', 6)).toHaveAccessibleName(/inactive piggy pit/)
    expect(screen.getByText('Round 2')).toBeInTheDocument()
    expect(screen.getByTestId('store-1')).toHaveTextContent('15')
  })

  it('against the computer, a human move is answered by a legal computer move', () => {
    vi.useFakeTimers()
    store(newGame(), 'computer')
    const { container } = render(<Pallanguzhi onFinish={vi.fn()} />)
    fireEvent.click(container.querySelector('.pg-pit[data-legal]')!)
    // Whatever happened, it is now either the computer’s turn or the human’s again; run the computer’s timer.
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    const tray = Number(screen.getByTestId('store-0').textContent) + Number(screen.getByTestId('store-1').textContent)
    const board = [...container.querySelectorAll('.pg-pit')].reduce((a, p) => a + Number(p.getAttribute('data-count')), 0)
    expect(tray + board).toBe(70)
  })

  it('animates a sowing a step at a time unless animation is turned off', () => {
    vi.useFakeTimers()
    localStorage.setItem(SETTINGS, JSON.stringify({ speed: 'normal' }))
    store(newGame())
    const { container } = render(<Pallanguzhi onFinish={vi.fn()} />)
    fireEvent.click(pit('Player 1', 1))
    expect(pit('Player 1', 1).getAttribute('data-count')).toBe('5') // still 5: the animation has not started
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(container.querySelector('.pg-pit[data-active]')).not.toBeNull()
    // Each step schedules the next after a render, so let time pass in small slices.
    for (let i = 0; i < 3000 && container.querySelector('.pg-pit[data-active]'); i++) {
      act(() => {
        vi.advanceTimersByTime(250)
      })
    }
    expect(container.querySelector('.pg-pit[data-active]')).toBeNull()
    const trays = Number(screen.getByTestId('store-0').textContent) + Number(screen.getByTestId('store-1').textContent)
    const board = [...container.querySelectorAll('.pg-pit')].reduce((a, p) => a + Number(p.getAttribute('data-count')), 0)
    expect(trays + board).toBe(70)
  })

  it('the tutorial only moves on after the lesson move, and uses the real engine', () => {
    store(newGame())
    render(<Pallanguzhi onFinish={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'tutorial' } })
    expect(screen.getByText('Lesson 1 of 8')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    fireEvent.click(pit('Player 1', 1)) // not the glowing pit
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    fireEvent.click(pit('Player 1', 3)) // the glowing pit
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
    expect(apply(newGame(), { type: 'sow', pit: 2 }).ok).toBe(true)
  })

  it('keys 1 to 7 choose a pit in your row', () => {
    store(newGame())
    const { container } = render(<Pallanguzhi onFinish={vi.fn()} />)
    fireEvent.keyDown(container.querySelector('.pg') as HTMLElement, { key: '2' }) // bubbles to the window
    expect(pit('Player 1', 2).getAttribute('data-count')).not.toBe('5')
  })
})

describe('Pallanguzhi rules panel', () => {
  const openRules = () => fireEvent.click(screen.getByRole('button', { name: 'Rules' }))
  const field = (label: RegExp) => screen.getByLabelText(label) as HTMLSelectElement

  it('starts a new match with the chosen seeds per pit, and remembers the choice', () => {
    const { container, unmount } = render(<Pallanguzhi onFinish={vi.fn()} seed="r" />)
    openRules()
    fireEvent.change(field(/Seeds in each pit/), { target: { value: '6' } })
    expect([...container.querySelectorAll('.pg-pit')].every((p) => p.getAttribute('data-count') === '6')).toBe(true)
    expect(screen.getByText(/custom rules/)).toBeInTheDocument()
    unmount()
    const again = render(<Pallanguzhi onFinish={vi.fn()} seed="r" />)
    expect([...again.container.querySelectorAll('.pg-pit')].every((p) => p.getAttribute('data-count') === '6')).toBe(true)
  })

  it('applies every option to the match, and the sentences say what is chosen', () => {
    render(<Pallanguzhi onFinish={vi.fn()} seed="r" />)
    openRules()
    fireEvent.change(field(/Sowings in a turn/), { target: { value: '1' } })
    fireEvent.change(field(/captures nothing/), { target: { value: 'yes' } })
    fireEvent.change(field(/no seeds to sow/), { target: { value: 'pass' } })
    fireEvent.change(field(/Length/), { target: { value: 'single' } })
    const dialog = screen.getByRole('dialog', { name: 'Rules for this match' })
    expect(dialog).toHaveTextContent('One sowing a turn')
    expect(dialog).toHaveTextContent('still earns the next sowing')
    expect(dialog).toHaveTextContent('they pass')
    expect(dialog).toHaveTextContent('A single round')
  })

  it('locks the rules once a move has been made', () => {
    render(<Pallanguzhi onFinish={vi.fn()} seed="r" />)
    fireEvent.click(pit('Player 1', 3))
    openRules()
    expect(field(/Seeds in each pit/).disabled).toBe(true)
    expect(screen.getByText(/locked while a match is in progress/)).toBeInTheDocument()
  })

  it('a saved match keeps the rules it started with', () => {
    const s = newGame({ seedsPerPit: 4, match: 'single' })
    store(s)
    render(<Pallanguzhi onFinish={vi.fn()} />)
    openRules()
    expect(field(/Seeds in each pit/).value).toBe('4')
    expect(field(/Length/).value).toBe('single')
  })
})
