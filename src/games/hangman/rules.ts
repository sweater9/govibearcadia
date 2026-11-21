import { createRandom, type Random } from '../../lib/rng'
import { CATEGORIES, WORDS, type CategoryId, type Difficulty, type Entry } from './words'

/**
 * Pure rules for Hangman. No React or browser APIs.
 *
 * You guess one letter at a time. A wrong letter costs one attempt; run out (6 on Hard, 7 on Medium, 8 on Easy) and you
 * lose. Optional hints: the clue (first hint) and a revealed letter (second hint); each costs points but never an
 * attempt. A word is worth a base score for its difficulty, plus points for every attempt left, minus points per hint,
 * plus a bonus for a winning streak.
 */
export const MAX_WRONG: Record<Difficulty, number> = { easy: 8, medium: 7, hard: 6 }
export const BASE_SCORE: Record<Difficulty, number> = { easy: 100, medium: 200, hard: 300 }
export const ATTEMPT_BONUS = 15
export const HINT_COST = 40
export const MAX_HINTS = 2
export const STREAK_BONUS = 10
export const STREAK_BONUS_CAP = 100
/** Parts drawn on the gallows: base, pole, beam, rope, head, body, two arms, two legs. */
export const GALLOWS_PARTS = 10

export type Status = 'playing' | 'won' | 'lost'
export type HState = {
  word: string
  clue: string
  category: string
  difficulty: Difficulty
  /** Letters guessed or revealed by a hint, in order. */
  guessed: string[]
  max: number
  hintsUsed: number
  clueShown: boolean
  status: Status
}

export const isLetter = (ch: string) => /^[a-z]$/.test(ch)
/** Letters only, 3 to 20 long: what a second player may set for a friend to guess. */
export const validSecret = (w: string) => /^[a-z]{3,20}$/.test(w)

export function newGame(word: string, clue: string, category: string, difficulty: Difficulty): HState {
  const w = word.toLowerCase()
  if (!validSecret(w)) throw new Error('A word must be 3 to 20 letters')
  return { word: w, clue, category, difficulty, guessed: [], max: MAX_WRONG[difficulty], hintsUsed: 0, clueShown: false, status: 'playing' }
}

export const wrongLetters = (s: HState): string[] => s.guessed.filter((l) => !s.word.includes(l))
export const wrongCount = (s: HState) => wrongLetters(s).length
export const attemptsLeft = (s: HState) => s.max - wrongCount(s)
/** The word with unguessed letters as null. */
export const masked = (s: HState): (string | null)[] => [...s.word].map((l) => (s.guessed.includes(l) || s.status === 'lost' ? l : null))
const solved = (s: HState) => [...s.word].every((l) => s.guessed.includes(l))

function settle(s: HState): HState {
  if (solved(s)) return { ...s, status: 'won' }
  if (wrongCount(s) >= s.max) return { ...s, status: 'lost' }
  return s
}

/** Guesses a letter. Anything invalid, repeated or after the end returns the same state. */
export function guess(s: HState, letter: string): HState {
  const l = letter.toLowerCase()
  if (s.status !== 'playing' || !isLetter(l) || s.guessed.includes(l)) return s
  return settle({ ...s, guessed: [...s.guessed, l] })
}

export const canHint = (s: HState) => s.status === 'playing' && s.hintsUsed < MAX_HINTS

/** First hint: show the clue. Second hint: reveal one letter you have not guessed. Never costs an attempt. */
export function hint(s: HState, random: Random): HState {
  if (!canHint(s)) return s
  if (!s.clueShown && s.clue) return { ...s, clueShown: true, hintsUsed: s.hintsUsed + 1 }
  const hidden = [...new Set([...s.word].filter((l) => !s.guessed.includes(l)))]
  if (hidden.length <= 1) return s // never hand over the last letter
  const pick = hidden[Math.floor(random() * hidden.length)]
  return settle({ ...s, guessed: [...s.guessed, pick], hintsUsed: s.hintsUsed + 1, clueShown: true })
}

/** Score for a finished word. `streak` counts this win (1 for the first win in a row). */
export function scoreFor(s: HState, streak: number): number {
  if (s.status !== 'won') return 0
  const base = BASE_SCORE[s.difficulty] + attemptsLeft(s) * ATTEMPT_BONUS - s.hintsUsed * HINT_COST
  return Math.max(10, base) + Math.min(STREAK_BONUS_CAP, Math.max(0, streak - 1) * STREAK_BONUS)
}

/** How many of the 10 gallows parts to draw: all of them exactly when the last attempt is used. */
export function gallowsParts(wrong: number, max: number): number {
  if (wrong <= 0) return 0
  return Math.min(GALLOWS_PARTS, Math.round((wrong / max) * GALLOWS_PARTS))
}

// ---------------------------------------------------------------- words

export type Pick = { entry: Entry; category: CategoryId }

/** A random word from one category (or any), avoiding recently used words until the pool is used up. */
export function pickWord(category: CategoryId | 'any', difficulty: Difficulty, random: Random, recent: readonly string[] = []): Pick {
  const cats = category === 'any' ? CATEGORIES.map((c) => c[0]) : [category]
  const pool: Pick[] = cats.flatMap((c) => WORDS[c][difficulty].map((entry) => ({ entry, category: c })))
  const fresh = pool.filter((p) => !recent.includes(p.entry.word))
  const from = fresh.length ? fresh : pool
  return from[Math.floor(random() * from.length)]
}

/** The word of the day: the same for everyone on a given UTC date. Medium difficulty, any category. */
export function dailyPick(day: string): Pick {
  return pickWord('any', 'medium', createRandom(`hangman:${day}`))
}

/** Every word in the list, for checks. */
export const allWords = (): { word: string; clue: string; category: CategoryId; difficulty: Difficulty }[] =>
  CATEGORIES.flatMap(([c]) => (['easy', 'medium', 'hard'] as Difficulty[]).flatMap((d) => WORDS[c][d].map((e) => ({ ...e, category: c, difficulty: d }))))
