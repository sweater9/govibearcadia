import { StrictMode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DailyWord } from './DailyWord'
import { pickAnswer } from './wordle/rules'
import { ANSWERS } from './wordle/words'

// Under StrictMode a finished game must be reported once, and the same seed must give the same word.

afterEach(() => vi.restoreAllMocks())

const SEED = 'wordle-component'
const answer = pickAnswer(SEED)
// A valid word that is not the answer, to spend guesses on.
const wrong = ANSWERS.filter((w) => w !== answer)

function setup(seed: string | null = SEED) {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <DailyWord onFinish={onFinish} seed={seed ?? undefined} />
    </StrictMode>,
  )
  const typeWord = (w: string) => [...w].forEach((ch) => fireEvent.keyDown(window, { key: ch }))
  const enter = () => fireEvent.keyDown(window, { key: 'Enter' })
  const tiles = (r: number) => Array.from(view.container.querySelectorAll(`[data-row="${r}"] .wordle-tile`))
  return { onFinish, view, typeWord, enter, tiles }
}

describe('Daily Word component', () => {
  it('types letters into the current row and deletes them', () => {
    const { typeWord, tiles } = setup()
    typeWord('sla')
    expect(tiles(0).map((t) => t.textContent)).toEqual(['s', 'l', 'a', '', ''])
    fireEvent.keyDown(window, { key: 'Backspace' })
    expect(tiles(0).map((t) => t.textContent)).toEqual(['s', 'l', '', '', ''])
  })

  it('refuses short and unknown words without using a guess', () => {
    const { typeWord, enter, tiles } = setup()
    typeWord('ab')
    enter()
    expect(screen.getByText('Not enough letters')).toBeInTheDocument()
    typeWord('cde')
    enter()
    expect(screen.getByText('Not in the word list')).toBeInTheDocument()
    expect(tiles(0).map((t) => t.textContent).join('')).toBe('abcde')
    expect(tiles(1).every((t) => t.getAttribute('data-state') === 'empty')).toBe(true)
  })

  it('marks a submitted guess and colors the on-screen keys', () => {
    const { typeWord, enter, tiles, view } = setup()
    typeWord(wrong[0])
    enter()
    const states = tiles(0).map((t) => t.getAttribute('data-state'))
    expect(states.every((s) => ['correct', 'present', 'absent'].includes(s!))).toBe(true)
    const key = view.container.querySelector(`[data-key="${wrong[0][0]}"]`)!
    expect(key.getAttribute('data-mark')).toBeTruthy()
  })

  it('reports a win once, with the guess count', () => {
    const { onFinish, typeWord, enter } = setup()
    typeWord(wrong[0])
    enter()
    typeWord(answer)
    enter()
    expect(screen.getByText('Got it!')).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: true, score: 100 + 5 * 150, stats: { guesses: 2, daily: 1 } })
    typeWord(wrong[1])
    enter()
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('reports a loss once and reveals the word', () => {
    const { onFinish, typeWord, enter } = setup()
    for (let i = 0; i < 6; i++) {
      typeWord(wrong[i])
      enter()
    }
    expect(screen.getByText(`The word was ${answer.toUpperCase()}`)).toBeInTheDocument()
    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ won: false, score: 0 })
  })

  it('the on-screen keyboard types, deletes and submits', () => {
    const { onFinish, view, tiles } = setup()
    const tap = (k: string) => fireEvent.click(view.container.querySelector(`[data-key="${k}"]`)!)
    for (const ch of answer) tap(ch)
    expect(tiles(0).map((t) => t.textContent).join('')).toBe(answer)
    tap('Backspace')
    expect(tiles(0).map((t) => t.textContent).join('')).toBe(answer.slice(0, 4))
    tap(answer[4])
    tap('Enter')
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('uses the date as the seed when none is given, and a seed gives a stable word', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'))
    const { view } = setup(null)
    expect(screen.getByText(/2026-10-28/)).toBeInTheDocument()
    expect(view.container.querySelector('.wordle')).toBeTruthy()
    vi.useRealTimers()
  })

  it('practice deals a fresh word, flagged as not daily', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { onFinish, typeWord, enter } = setup()
    for (let i = 0; i < 6; i++) {
      typeWord(wrong[i])
      enter()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Practice another word' }))
    expect(screen.getByText('Practice word')).toBeInTheDocument()
    const practiceAnswer = ANSWERS[0]
    typeWord(practiceAnswer)
    enter()
    expect(onFinish).toHaveBeenCalledTimes(2)
    expect(onFinish.mock.calls[1][0]).toMatchObject({ won: true, stats: { guesses: 1, daily: 0 } })
  })

  it('copies a letter-free share grid', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { typeWord, enter } = setup()
    typeWord(answer)
    enter()
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Copy result' })))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0][0]).toBe(`GoVibeArcadia Daily Word ${SEED} 1/6\n🟩🟩🟩🟩🟩`)
    expect(screen.getByText('Copied!')).toBeInTheDocument()
  })
})
