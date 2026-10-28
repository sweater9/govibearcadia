import { describe, expect, it } from 'vitest'
import { ANSWERS, VALID } from './words'
import { LENGTH, backspace, evaluate, isValidWord, letterMarks, newGame, pickAnswer, scoreFor, shareText, submit, typeLetter, type WordState } from './rules'

const typeWord = (s: WordState, w: string) => [...w].reduce(typeLetter, s)
const guess = (s: WordState, w: string) => submit(typeWord(s, w))

describe('Daily Word lists', () => {
  it('every answer is a 5-letter lowercase word that is also a valid guess, with no duplicates', () => {
    expect(new Set(ANSWERS).size).toBe(ANSWERS.length)
    for (const a of ANSWERS) {
      expect(a).toMatch(/^[a-z]{5}$/)
      expect(VALID.has(a)).toBe(true)
    }
    expect(ANSWERS.length).toBeGreaterThan(365)
    expect(VALID.size).toBeGreaterThan(10000)
  })
})

describe('evaluate', () => {
  it('marks exact, misplaced and absent letters', () => {
    expect(evaluate('crane', 'crane')).toEqual(Array(5).fill('correct'))
    expect(evaluate('slate', 'crane')).toEqual(['absent', 'absent', 'correct', 'absent', 'correct'])
    expect(evaluate('nacre', 'crane')).toEqual(['present', 'present', 'present', 'present', 'correct'])
  })

  it('handles repeated letters: a duplicate is yellow only while the answer has a spare copy', () => {
    // answer has ONE e; the guess has three
    expect(evaluate('eerie', 'crane')).toEqual(['absent', 'absent', 'present', 'absent', 'correct'])
    // answer "abbey", guess "babes": the third letter and the e are green, b and a are misplaced
    expect(evaluate('babes', 'abbey')).toEqual(['present', 'present', 'correct', 'correct', 'absent'])
    // the only 'e' is taken by the green one at the end, so earlier e's are absent
    expect(evaluate('geese', 'those')).toEqual(['absent', 'absent', 'absent', 'correct', 'correct'])
  })
})

describe('pickAnswer', () => {
  it('is deterministic per seed, and different seeds spread across the list', () => {
    expect(pickAnswer('2026-10-28')).toBe(pickAnswer('2026-10-28'))
    const days = Array.from({ length: 60 }, (_, i) => pickAnswer(`2026-11-${i}`))
    expect(new Set(days).size).toBeGreaterThan(40)
    for (const d of days) expect(ANSWERS).toContain(d)
  })
})

describe('typing and submitting', () => {
  const base = newGame('crane')

  it('types up to five letters, deletes, and ignores non-letters', () => {
    let s = typeWord(base, 'sla')
    expect(s.current).toBe('sla')
    s = typeLetter(s, '1')
    s = typeLetter(s, 'A')
    expect(s.current).toBe('sla')
    expect(backspace(s).current).toBe('sl')
    expect(typeWord(base, 'abcdefg').current).toHaveLength(LENGTH)
    expect(backspace(base)).toBe(base)
  })

  it('refuses short and unknown words without spending a guess', () => {
    const short = submit(typeWord(base, 'abc'))
    expect(short.notice).toBe('short')
    expect(short.guesses).toHaveLength(0)
    const unknown = submit(typeWord(base, 'zzzzz'))
    expect(unknown.notice).toBe('unknown')
    expect(unknown.guesses).toHaveLength(0)
    expect(unknown.current).toBe('zzzzz')
    expect(typeLetter(backspace(unknown), 'q').notice).toBeNull()
  })

  it('wins on the right word and scores by guesses used', () => {
    const won = guess(guess(base, 'slate'), 'crane')
    expect(won.status).toBe('won')
    expect(won.guesses).toEqual(['slate', 'crane'])
    expect(scoreFor(won)).toBe(100 + 5 * 150)
    expect(scoreFor(guess(base, 'crane'))).toBe(1000)
  })

  it('loses after six wrong guesses and then accepts nothing', () => {
    let s = base
    for (const w of ['slate', 'lions', 'ghost', 'mount', 'pudgy', 'wheat']) s = guess(s, w)
    expect(s.status).toBe('lost')
    expect(scoreFor(s)).toBe(0)
    expect(typeLetter(s, 'a')).toBe(s)
    expect(submit(s)).toBe(s)
  })

  it('every word in the valid list is accepted as a guess', () => {
    expect(isValidWord('crane')).toBe(true)
    expect(isValidWord('qqqqq')).toBe(false)
  })
})

describe('keyboard marks and sharing', () => {
  it('keeps the best mark per letter', () => {
    const s = guess(guess(newGame('crane'), 'eerie'), 'nacre')
    const marks = letterMarks(s)
    expect(marks.e).toBe('correct') // green in one guess beats yellow/absent in another
    expect(marks.r).toBe('present')
    expect(marks.i).toBe('absent')
  })

  it('shares a letter-free grid', () => {
    const s = guess(guess(newGame('crane'), 'slate'), 'crane')
    const text = shareText(s, '2026-10-28')
    expect(text).toBe('GoVibeArcadia Daily Word 2026-10-28 2/6\n⬛⬛🟩⬛🟩\n🟩🟩🟩🟩🟩')
    expect(text).not.toMatch(/crane|slate/)
  })
})
