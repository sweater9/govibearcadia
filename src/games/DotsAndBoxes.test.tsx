import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DotsAndBoxes } from './DotsAndBoxes'
import { boxSides } from './dots/rules'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

const edge = (n: number) => document.querySelector(`[data-edge="${n}"]`) as SVGElement | null

function setup(props: Record<string, unknown> = {}) {
  const onFinish = vi.fn()
  render(
    <StrictMode>
      <DotsAndBoxes onFinish={onFinish} seed="dots" {...props} />
    </StrictMode>,
  )
  return { onFinish }
}
const startSized = (rows: number, level = 'easy') => {
  fireEvent.click(screen.getByRole('button', { name: /New game/ }))
  fireEvent.click(screen.getByRole('button', { name: /Custom/ }))
  const [r, c] = screen.getAllByRole('spinbutton')
  fireEvent.change(r, { target: { value: String(rows) } })
  fireEvent.change(c, { target: { value: String(rows) } })
  fireEvent.change(screen.getByLabelText('Computer level'), { target: { value: level } })
  fireEvent.click(screen.getByRole('button', { name: 'Start' }))
}

describe('Dots and Boxes component', () => {
  it('draws a 4x4 board by default and a line on click, then the computer replies', () => {
    setup()
    expect(document.querySelectorAll('[data-edge]').length).toBe(40)
    fireEvent.click(edge(0)!)
    expect(edge(0)).toBeNull()
    expect(screen.getByRole('status').textContent).toMatch(/thinking/)
    act(() => { vi.advanceTimersByTime(700) })
    expect(document.querySelectorAll('[data-edge]').length).toBe(38)
  })

  it('ignores clicks while the computer is moving', () => {
    setup()
    fireEvent.click(edge(0)!)
    fireEvent.click(edge(1)!)
    expect(edge(1)).not.toBeNull() // still open: the click did nothing
    expect(screen.getByRole('status').textContent).toMatch(/thinking/)
  })

  it('undo takes back the computer move and the player move', () => {
    setup()
    fireEvent.click(edge(0)!)
    act(() => { vi.advanceTimersByTime(700) })
    fireEvent.click(screen.getByRole('button', { name: /Undo/ }))
    expect(document.querySelectorAll('[data-edge]').length).toBe(40)
  })

  it('reports a finished game exactly once under StrictMode', () => {
    const { onFinish } = setup()
    startSized(2)
    // Play the human side by always drawing the first open line; the computer answers on its timer.
    for (let i = 0; i < 40; i++) {
      const open = document.querySelector('[data-edge]')
      if (open) fireEvent.click(open)
      act(() => { vi.advanceTimersByTime(700) })
      if (!document.querySelector('[data-edge]')) break
    }
    expect(screen.getByRole('status').textContent).toMatch(/wins|draw/)
    expect(onFinish).toHaveBeenCalledTimes(1)
    const r = onFinish.mock.calls[0][0]
    expect(r.stats.size).toBe(4)
    expect(r.stats.boxes + r.stats.opponent).toBe(4)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('a box completed by the player gives another turn', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /New game/ }))
    fireEvent.change(screen.getByLabelText('Opponent'), { target: { value: 'two' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    const sides = boxSides(4, 4, 5)
    for (const s of sides.slice(0, 3)) fireEvent.click(edge(s)!)
    fireEvent.click(edge(sides[3])!)
    expect(screen.getByRole('status').textContent).toMatch(/Player 2.*extra turn/)
    expect(screen.getByText(/Player 2:/).textContent).toMatch(/1/)
  })

  it('a computer opponent from quick match is labelled as a computer', () => {
    setup({ computer: 'Ada' })
    expect(screen.getByText(/Ada \(computer\):/)).toBeTruthy()
  })
})
