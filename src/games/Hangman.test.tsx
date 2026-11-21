import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Hangman } from './Hangman'

beforeEach(() => localStorage.clear())

function setup(seed = 'hm-component') {
  const onFinish = vi.fn()
  const view = render(
    <StrictMode>
      <Hangman onFinish={onFinish} seed={seed} />
    </StrictMode>,
  )
  const word = () => [...view.container.querySelectorAll('.hm-word span')]
  return { onFinish, view, word }
}

const letter = (l: string) => screen.getByRole('button', { name: new RegExp(`^Letter ${l.toUpperCase()}\\b`) })
const press = (l: string) => fireEvent.keyDown(window, { key: l })
const ALPHABET = [...'abcdefghijklmnopqrstuvwxyz']

describe('Hangman component', () => {
  it('shows blanks for the word, the whole keyboard, and the attempts left', () => {
    const { word } = setup()
    expect(word().length).toBeGreaterThanOrEqual(3)
    expect(word().every((s) => s.textContent === '')).toBe(true)
    expect(screen.getAllByRole('button', { name: /^Letter / })).toHaveLength(26)
    expect(screen.getByText(/attempts left/)).toBeTruthy()
  })

  it('tracks used letters on screen, with a text mark as well as colour, and announces the result', () => {
    setup('hm-used')
    press('e')
    const e = letter('e')
    expect((e as HTMLButtonElement).disabled).toBe(true)
    expect(e.getAttribute('aria-label')).toMatch(/in the word|not in the word/)
    expect(e.textContent).toMatch(/[✓✗]/)
    expect(document.querySelector('.hm-note')?.textContent).toMatch(/^(E is in the word|No E)/)
  })

  it('works from the keyboard and from tapping the letters, and ignores a repeated letter', () => {
    setup('hm-input')
    fireEvent.click(letter('a'))
    press('a')
    press('1')
    const used = screen.getAllByRole('button', { name: /^Letter / }).filter((b) => (b as HTMLButtonElement).disabled)
    expect(used).toHaveLength(1)
  })

  it('finishes a word, reports it exactly once (even in StrictMode), and offers a new word', () => {
    const { onFinish, word } = setup('hm-finish')
    for (const l of ALPHABET) press(l)
    expect(onFinish).toHaveBeenCalledTimes(1)
    const r = onFinish.mock.calls[0][0]
    expect(typeof r.won).toBe('boolean')
    expect(r.score).toBe(r.won ? r.score : 0)
    expect(r.stats.length).toBeGreaterThanOrEqual(3)
    expect(word().every((s) => s.textContent !== '')).toBe(true) // the word is revealed at the end
    fireEvent.click(screen.getByRole('button', { name: 'New word' }))
    expect(word().every((s) => s.textContent === '')).toBe(true)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('hints: the first shows the clue, the second reveals a letter, and they run out', () => {
    const { word } = setup('hm-hint')
    const hintBtn = () => screen.getByRole('button', { name: /^Hint,/ }) as HTMLButtonElement
    fireEvent.click(hintBtn())
    expect(screen.getByText(/^Clue: /)).toBeTruthy()
    fireEvent.click(hintBtn())
    expect(word().some((s) => s.textContent !== '')).toBe(true)
    expect(hintBtn().disabled).toBe(true)
  })

  it('hints can be turned off in the settings', () => {
    setup('hm-nohint')
    fireEvent.click(screen.getByRole('button', { name: /New game/ }))
    fireEvent.click(screen.getByLabelText(/Allow hints/))
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.queryByRole('button', { name: /^Hint,/ })).toBeNull()
  })

  it('offers all ten categories and three difficulties, and plays the chosen one', () => {
    setup('hm-cat')
    fireEvent.click(screen.getByRole('button', { name: /New game/ }))
    const cat = screen.getByLabelText('Category') as HTMLSelectElement
    expect([...cat.options].map((o) => o.text)).toEqual(['Any category', 'Animals', 'Countries', 'Food', 'Technology', 'Science', 'Movies', 'Sports', 'General knowledge', 'Nature', 'History'])
    expect([...(screen.getByLabelText('Difficulty') as HTMLSelectElement).options].map((o) => o.text)).toEqual(['Easy', 'Medium', 'Hard'])
    fireEvent.change(cat, { target: { value: 'sports' } })
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'easy' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByText(/Sports · Easy/)).toBeTruthy()
  })

  it('two players: the secret word is hidden while typed, the guesser plays it, and it is not scored for the arcade', () => {
    const { onFinish, word } = setup('hm-two')
    fireEvent.click(screen.getByRole('button', { name: /New game/ }))
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'two' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    const input = screen.getByLabelText('Secret word') as HTMLInputElement
    expect(input.type).toBe('password')
    fireEvent.change(input, { target: { value: 'no' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hide and pass the device' }))
    expect(screen.getByRole('alert').textContent).toMatch(/3 to 20 letters/)
    fireEvent.change(input, { target: { value: 'kite' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hide and pass the device' }))
    expect(word()).toHaveLength(4)
    for (const l of 'kite') press(l)
    expect(screen.getByText(/Player 2 got it!/)).toBeTruthy()
    expect(onFinish).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Next round (swap roles)' }))
    expect(screen.getByText(/Player 2 sets the word/)).toBeTruthy()
  })

  it('the daily word is the same on every visit that day, and today\'s result is remembered', () => {
    const first = setup('hm-d1')
    fireEvent.click(screen.getByRole('button', { name: /New game/ }))
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'daily' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    const a = first.word().length
    first.view.unmount()
    const second = setup('hm-d2')
    fireEvent.click(screen.getByRole('button', { name: /New game/ }))
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'daily' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(second.word().length).toBe(a)
    for (const l of ALPHABET) press(l)
    const saved = JSON.parse(localStorage.getItem('govibearcadia.hangman') ?? '{}')
    expect(saved.daily?.day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(saved.played).toBe(1)
  })
})
