import { afterEach, describe, expect, it } from 'vitest'
import { attachGameSound, isSoundOn, isWinText, setSoundOn } from './sound'

afterEach(() => localStorage.clear())

describe('sound', () => {
  it('is off until the player turns it on, and remembers the choice', () => {
    expect(isSoundOn()).toBe(false)
    setSoundOn(true)
    expect(isSoundOn()).toBe(true)
    setSoundOn(false)
    expect(isSoundOn()).toBe(false)
  })
  it('tells wins from losses by the panel heading', () => {
    for (const t of ['You win!', 'Perfect sync! Score 5', 'Board cleared']) expect(isWinText(t)).toBe(true)
    for (const t of ['Computer wins', 'Signal lost', 'Draw', 'Boom']) expect(isWinText(t)).toBe(false)
  })
  it('never throws when there is no audio support', () => {
    const root = document.createElement('div')
    root.innerHTML = '<button>x</button>'
    const off = attachGameSound(root)
    root.querySelector('button')!.click()
    root.insertAdjacentHTML('beforeend', '<div class="game-over"><h3>You win!</h3></div>')
    off()
  })
})
