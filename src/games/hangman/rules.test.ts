import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { ATTEMPT_BONUS, BASE_SCORE, HINT_COST, MAX_HINTS, MAX_WRONG, allWords, attemptsLeft, canHint, dailyPick, gallowsParts, guess, hint, masked, newGame, pickWord, scoreFor, validSecret, wrongLetters } from './rules'
import { CATEGORIES, WORDS, type Difficulty } from './words'

const game = (word = 'planet', d: Difficulty = 'medium') => newGame(word, 'A world', 'science', d)

describe('the word list', () => {
  const all = allWords()
  it('has ten categories with ten words at each of three difficulties', () => {
    expect(CATEGORIES.map((c) => c[1])).toEqual(['Animals', 'Countries', 'Food', 'Technology', 'Science', 'Movies', 'Sports', 'General knowledge', 'Nature', 'History'])
    expect(all).toHaveLength(10 * 3 * 10)
    for (const [c] of CATEGORIES) for (const d of ['easy', 'medium', 'hard'] as const) expect(WORDS[c][d]).toHaveLength(10)
  })
  it('uses single lowercase words, a to z only', () => {
    for (const w of all) expect(w.word, w.word).toMatch(/^[a-z]+$/)
  })
  it('scales with difficulty: easy is short, hard is long', () => {
    for (const w of all) {
      const n = w.word.length
      const [lo, hi] = w.difficulty === 'easy' ? [3, 6] : w.difficulty === 'medium' ? [6, 9] : [8, 14]
      expect(n, w.word).toBeGreaterThanOrEqual(lo)
      expect(n, w.word).toBeLessThanOrEqual(hi)
    }
  })
  it('has no duplicate words anywhere, and a clue for each that does not give the word away', () => {
    expect(new Set(all.map((w) => w.word)).size).toBe(all.length)
    for (const w of all) {
      expect(w.clue.length, w.word).toBeGreaterThan(3)
      expect(w.clue.toLowerCase(), w.word).not.toContain(w.word)
    }
  })
  it('keeps to a general audience (no word or clue on a blocklist of unsuitable terms)', () => {
    const blocked = /\b(sex|porn|nude|kill|murder|drug|cocaine|heroin|rape|suicide|slave|nazi|hate|damn|hell)\b/i
    for (const w of all) expect(`${w.word} ${w.clue}`, w.word).not.toMatch(blocked)
  })
})

describe('guessing', () => {
  it('reveals every copy of a right letter and costs nothing', () => {
    let s = game('banana')
    s = guess(s, 'a')
    expect(masked(s)).toEqual([null, 'a', null, 'a', null, 'a'])
    expect(attemptsLeft(s)).toBe(MAX_WRONG.medium)
  })
  it('counts a wrong letter once, ignores repeats and non-letters', () => {
    let s = game('banana')
    s = guess(s, 'z')
    expect(wrongLetters(s)).toEqual(['z'])
    expect(attemptsLeft(s)).toBe(MAX_WRONG.medium - 1)
    expect(guess(s, 'z')).toBe(s)
    expect(guess(s, '1')).toBe(s)
    expect(guess(s, 'ab')).toBe(s)
    expect(guess(s, 'A').guessed).toContain('a')
  })
  it('wins when every letter is found', () => {
    let s = game('cat', 'easy')
    for (const l of 'cat') s = guess(s, l)
    expect(s.status).toBe('won')
    expect(guess(s, 'z')).toBe(s)
  })
  it('loses after the allowed wrong guesses and then shows the word', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      let s = game('quiz', d)
      for (const l of 'bcdefghjklmn'.slice(0, MAX_WRONG[d] - 1)) s = guess(s, l)
      expect(s.status).toBe('playing')
      s = guess(s, 'x')
      expect(s.status).toBe('lost')
      expect(masked(s).join('')).toBe('quiz')
    }
  })
  it('rejects secrets that are not 3 to 20 letters', () => {
    expect(validSecret('hello')).toBe(true)
    expect(validSecret('hi')).toBe(false)
    expect(validSecret('two words')).toBe(false)
    expect(validSecret('abc1')).toBe(false)
    expect(() => newGame('a', '', 'x', 'easy')).toThrow()
  })
})

describe('hints', () => {
  it('the first hint shows the clue, the second reveals an unguessed letter, then no more', () => {
    const r = createRandom('h')
    let s = game('planet')
    s = hint(s, r)
    expect(s.clueShown).toBe(true)
    expect(s.hintsUsed).toBe(1)
    expect(s.guessed).toEqual([])
    s = hint(s, r)
    expect(s.hintsUsed).toBe(2)
    expect(s.guessed).toHaveLength(1)
    expect('planet').toContain(s.guessed[0])
    expect(canHint(s)).toBe(false)
    expect(hint(s, r)).toBe(s)
    expect(MAX_HINTS).toBe(2)
  })
  it('never costs an attempt and never gives away the last letter', () => {
    const r = createRandom('h2')
    let s = newGame('abc', '', 'x', 'easy') // no clue, so the first hint reveals a letter
    s = hint(s, r)
    s = hint(s, r)
    expect(attemptsLeft(s)).toBe(MAX_WRONG.easy)
    expect(s.status).toBe('playing')
    expect(masked(s).filter((l) => l === null)).toHaveLength(1)
  })
})

describe('score', () => {
  it('is zero for a loss and rewards a win by difficulty, attempts left, hints and streak', () => {
    let s = game('cat', 'easy')
    for (const l of 'cat') s = guess(s, l)
    expect(scoreFor(s, 1)).toBe(BASE_SCORE.easy + MAX_WRONG.easy * ATTEMPT_BONUS)
    expect(scoreFor(s, 4)).toBe(BASE_SCORE.easy + MAX_WRONG.easy * ATTEMPT_BONUS + 30)
    expect(scoreFor(s, 100)).toBe(BASE_SCORE.easy + MAX_WRONG.easy * ATTEMPT_BONUS + 100)
    const hinted = { ...s, hintsUsed: 2 }
    expect(scoreFor(hinted, 1)).toBe(BASE_SCORE.easy + MAX_WRONG.easy * ATTEMPT_BONUS - 2 * HINT_COST)
    const lost = { ...s, status: 'lost' as const }
    expect(scoreFor(lost, 5)).toBe(0)
  })
  it('harder words score more', () => {
    expect(BASE_SCORE.easy).toBeLessThan(BASE_SCORE.medium)
    expect(BASE_SCORE.medium).toBeLessThan(BASE_SCORE.hard)
  })
})

describe('the gallows drawing', () => {
  it('draws nothing at first and all ten parts exactly on the last attempt, whatever the difficulty', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const max = MAX_WRONG[d]
      expect(gallowsParts(0, max)).toBe(0)
      expect(gallowsParts(max, max)).toBe(10)
      let last = 0
      for (let w = 1; w <= max; w++) {
        const p = gallowsParts(w, max)
        expect(p).toBeGreaterThanOrEqual(last)
        expect(p).toBeGreaterThan(0)
        last = p
      }
    }
  })
})

describe('choosing words', () => {
  it('picks from the chosen category and difficulty, the same way for the same seed', () => {
    const a = pickWord('animals', 'easy', createRandom('s'))
    expect(a.category).toBe('animals')
    expect(WORDS.animals.easy.map((e) => e.word)).toContain(a.entry.word)
    expect(pickWord('animals', 'easy', createRandom('s')).entry.word).toBe(a.entry.word)
  })
  it('does not repeat recent words until the pool is used up', () => {
    const seen: string[] = []
    const r = createRandom('rep')
    for (let i = 0; i < 10; i++) seen.push(pickWord('food', 'hard', r, seen).entry.word)
    expect(new Set(seen).size).toBe(10)
    expect(WORDS.food.hard.map((e) => e.word)).toContain(pickWord('food', 'hard', r, seen).entry.word)
  })
  it('"any category" reaches every category', () => {
    const r = createRandom('any')
    const cats = new Set<string>()
    for (let i = 0; i < 400; i++) cats.add(pickWord('any', 'medium', r).category)
    expect(cats.size).toBe(10)
  })
  it('the daily word is the same for everyone on a day and changes between days', () => {
    expect(dailyPick('2026-11-21').entry.word).toBe(dailyPick('2026-11-21').entry.word)
    const days = new Set(Array.from({ length: 30 }, (_, i) => dailyPick(`2026-12-${String(i + 1).padStart(2, '0')}`).entry.word))
    expect(days.size).toBeGreaterThan(15)
  })
})

describe('a hard-coded dictionary check', () => {
  it('has the words the user would expect in a couple of categories', () => {
    expect(WORDS.animals.medium.map((e) => e.word)).toContain('giraffe')
    expect(WORDS.countries.easy.map((e) => e.word)).toContain('japan')
  })
})
