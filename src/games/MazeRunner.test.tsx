import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MazeRunner } from './MazeRunner'
import { campaignLevel } from './maze/levels'
import { DIRS, DIR_LIST, coverRoute, type Dir } from './maze/rules'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('govibearcadia.maze', JSON.stringify({ unlocked: 1, levels: {}, coins: 0, endless: { top: [] }, achievements: [], settings: { difficulty: 'practice', dpad: false } }))
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  HTMLCanvasElement.prototype.getContext = (() => null) as never
})
afterEach(() => vi.useRealTimers())

const stage = () => document.querySelector('.mz-stage') as HTMLElement
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
function setup(props: Record<string, unknown> = {}) {
  const onFinish = vi.fn()
  render(
    <StrictMode>
      <MazeRunner onFinish={onFinish} {...props} />
    </StrictMode>,
  )
  return { onFinish }
}
const key = (k: string) => { fireEvent.keyDown(window, { key: k }); fireEvent.keyUp(window, { key: k }) }
const ARROW: Record<Dir, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }

function solveLevel(n: number) {
  const l = campaignLevel(n)
  const cells = coverRoute(l)
  for (let i = 1; i < cells.length; i++) {
    const dx = (cells[i] % l.w) - (cells[i - 1] % l.w)
    const dy = Math.floor(cells[i] / l.w) - Math.floor(cells[i - 1] / l.w)
    const d = DIR_LIST.find((x) => DIRS[x].dx === dx && DIRS[x].dy === dy) as Dir
    key(ARROW[d])
    wait(200)
  }
}

describe('Maze Runner component', () => {
  it('opens on level 1, ready to start, and does not run the clock before the first move', () => {
    setup()
    expect(screen.getByText('Level 1')).toBeTruthy()
    expect(screen.getByText(/Press an arrow key/)).toBeTruthy()
    expect(screen.getByText(/Pellets left/)).toBeTruthy()
    wait(3000)
    expect(stage().dataset.steps).toBe('0')
  })

  it('moves with the arrow keys and wasd', () => {
    setup()
    const l = campaignLevel(1)
    expect(stage().dataset.x).toBe(String(l.start.x))
    const open = DIR_LIST.find((d) => !(l.walls[l.start.y * l.w + l.start.x] & DIRS[d].bit) && l.start.x + DIRS[d].dx >= 0 && l.start.y + DIRS[d].dy >= 0 && l.start.y + DIRS[d].dy < l.h) as Dir
    key(ARROW[open])
    wait(200)
    expect(stage().dataset.steps).toBe('1')
  })

  it('eating every pellet on level 1 reports once, shows stars, saves progress and unlocks level 2', () => {
    const { onFinish } = setup()
    solveLevel(1)
    wait(500)
    expect(stage().dataset.status).toBe('won')
    expect(screen.getByRole('dialog', { name: 'Level cleared' })).toBeTruthy()
    expect(screen.getByLabelText(/of 3 stars/)).toBeTruthy()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true, stats: { level: 1 } })
    wait(5000)
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('govibearcadia.maze') as string).unlocked).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Level 2')).toBeTruthy()
  })

  it('P pauses and resumes', () => {
    setup()
    key('ArrowDown')
    key('p')
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeTruthy()
    const steps = stage().dataset.steps
    key('ArrowRight')
    wait(500)
    expect(stage().dataset.steps).toBe(steps)
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(screen.queryByRole('dialog', { name: 'Paused' })).toBeNull()
  })

  it('the level menu locks levels you have not reached and starts Endless', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Levels/ }))
    expect(screen.getAllByRole('button', { name: /^Level \d+/ })).toHaveLength(50)
    expect((screen.getByRole('button', { name: /^Level 2, locked/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /^Level 1(,|$)/ }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Start Endless' }))
    expect(screen.getByText('Maze 1')).toBeTruthy()
  })

  it('the on-screen pad is optional and works', () => {
    setup()
    expect(screen.queryByLabelText('On-screen pad')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Levels/ }))
    fireEvent.click(screen.getByLabelText('Show the on-screen pad'))
    fireEvent.click(screen.getByRole('button', { name: 'Back to the maze' }))
    expect(screen.getByLabelText('On-screen pad')).toBeTruthy()
    const l = campaignLevel(1)
    const open = DIR_LIST.find((d) => !(l.walls[l.start.y * l.w + l.start.x] & DIRS[d].bit) && l.start.x + DIRS[d].dx >= 0 && l.start.y + DIRS[d].dy >= 0 && l.start.y + DIRS[d].dy < l.h) as Dir
    fireEvent.click(screen.getByRole('button', { name: `Move ${open}` }))
    wait(200)
    expect(stage().dataset.steps).toBe('1')
  })

  it('given a seed (the daily challenge) it opens the same fixed maze and leaves the campaign alone', () => {
    setup({ seed: '2026-11-25' })
    expect(screen.getByText('Daily maze')).toBeTruthy()
    const saved = JSON.parse(localStorage.getItem('govibearcadia.maze') as string)
    expect(saved.unlocked).toBe(1)
    expect(saved.levels).toEqual({})
  })
})
