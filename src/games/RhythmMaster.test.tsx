import { StrictMode } from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RhythmMaster } from './RhythmMaster'
import { makeChart } from './rhythm/rules'

// Under StrictMode (double-invoked effects), the loop must run once, and a finished song is reported once.

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date', 'setTimeout', 'clearTimeout'] })
})
afterEach(() => vi.useRealTimers())

function setup(seed = 'rm-component') {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <RhythmMaster onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const field = view.container.querySelector<HTMLElement>('.rm-field')!
  const run = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
  return { onFinish, field, run, view }
}

describe('Rhythm Master component', () => {
  it('waits to start, then runs the song with the clock', () => {
    const { field, run } = setup()
    expect(field.dataset.status).toBe('ready')
    expect(Number(field.dataset.notes)).toBeGreaterThan(20)
    fireEvent.keyDown(window, { key: ' ' })
    expect(field.dataset.status).toBe('playing')
    run(1000)
    expect(field.dataset.status).toBe('playing')
  })

  it('scores a press in the right lane as the note arrives, and ignores other keys until started', () => {
    const { field, run } = setup('rm-hit')
    fireEvent.keyDown(window, { key: 'd' })
    expect(field.dataset.status).toBe('ready')
    const first = makeChart('drift', 'normal', 'rm-hit')[0]
    fireEvent.keyDown(window, { key: ' ' })
    run(first.t - 8)
    fireEvent.keyDown(window, { key: ['d', 'f', 'j', 'k'][first.lane] })
    expect(Number(field.dataset.perfect) + Number(field.dataset.good)).toBe(1)
    expect(Number(field.dataset.combo)).toBe(1)
    expect(Number(field.dataset.score)).toBeGreaterThan(0)
  })

  it('pause stops the song clock', () => {
    const { field, run } = setup()
    fireEvent.keyDown(window, { key: ' ' })
    run(500)
    fireEvent.keyDown(window, { key: 'p' })
    expect(field.dataset.status).toBe('paused')
    run(60000)
    expect(field.dataset.status).toBe('paused')
  })

  it('reports an idle song exactly once, as a loss with all notes missed', () => {
    const { field, onFinish, run, view } = setup('rm-idle')
    fireEvent.keyDown(window, { key: ' ' })
    run(120000)
    expect(field.dataset.status).toBe('over')
    expect(view.container.querySelector('.game-over')).not.toBeNull()
    expect(onFinish).toHaveBeenCalledTimes(1)
    const result = onFinish.mock.calls[0][0]
    expect(result.won).toBe(false)
    expect(result.score).toBe(0)
    expect(result.stats.miss).toBe(result.stats.notes)
    run(20000)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('a run abandoned with points is reported once, and a fresh game is not', () => {
    const { field, onFinish, run, view } = setup('rm-abandon')
    const first = makeChart('drift', 'normal', 'rm-abandon')[0]
    fireEvent.keyDown(window, { key: ' ' })
    run(first.t - 8)
    fireEvent.keyDown(window, { key: ['d', 'f', 'j', 'k'][first.lane] })
    const restart = view.container.querySelector<HTMLButtonElement>('button[aria-label="New game"]')!
    fireEvent.click(restart)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(field.dataset.status).toBe('ready')
    fireEvent.click(restart)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('remembers the timing offset', () => {
    const { view } = setup()
    const slider = view.container.querySelector<HTMLInputElement>('input[aria-label="Timing offset"]')!
    fireEvent.change(slider, { target: { value: '40' } })
    expect(localStorage.getItem('govibearcadia.rhythm.offset')).toBe('40')
  })
})
