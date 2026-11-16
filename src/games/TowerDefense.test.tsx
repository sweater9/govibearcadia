import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TowerDefense } from './TowerDefense'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number)
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const tick = (ms = 1000) => act(() => void vi.advanceTimersByTime(ms))

describe('TowerDefense', () => {
  it('builds with a click and spends gold, once under StrictMode', () => {
    render(<StrictMode><TowerDefense onFinish={vi.fn()} seed="u" /></StrictMode>)
    fireEvent.click(screen.getByRole('button', { name: 'Normal' }))
    fireEvent.click(screen.getByLabelText('Empty cell, column 1, row 1'))
    expect(screen.getByTestId('td-gold')).toHaveTextContent('100')
    expect(screen.getByLabelText(/Bolt tower level 1 at column 1, row 1/)).toBeInTheDocument()
  })
  it('refuses the path and unaffordable towers with a note', () => {
    render(<TowerDefense onFinish={vi.fn()} seed="u" />)
    fireEvent.click(screen.getByLabelText('Empty cell, column 1, row 1'))
    fireEvent.keyDown(window, { key: '3' })
    fireEvent.click(screen.getByLabelText('Empty cell, column 2, row 1'))
    fireEvent.keyDown(window, { key: '3' })
    fireEvent.click(screen.getByLabelText('Empty cell, column 3, row 1'))
    expect(screen.getByText('Not enough gold.')).toBeInTheDocument()
  })
  it('reports an overrun exactly once under StrictMode', () => {
    const onFinish = vi.fn()
    render(<StrictMode><TowerDefense onFinish={onFinish} seed="u" /></StrictMode>)
    for (let i = 0; i < 60 && !screen.queryByText('Overrun'); i++) {
      const send = screen.getByRole('button', { name: /^(Start|Send) wave/ })
      if (!(send as HTMLButtonElement).disabled) fireEvent.click(send)
      tick(30000)
    }
    expect(screen.getByText('Overrun')).toBeInTheDocument()
    tick(5000)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: false })
  })
  it('keyboard: arrows move, Enter builds, N sends a wave', () => {
    render(<TowerDefense onFinish={vi.fn()} seed="u" />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByLabelText(/Bolt tower level 1 at column 2, row 1/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'n' })
    expect(screen.getByTestId('td-wave')).toHaveTextContent('1/12')
  })
})
