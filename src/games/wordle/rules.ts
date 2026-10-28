import { hashSeed } from '../../lib/rng'
import { ANSWERS, VALID } from './words'

/** Pure Daily Word rules: no React or browser APIs. */

export const LENGTH = 5
export const MAX_GUESSES = 6
export type Mark = 'correct' | 'present' | 'absent'
export type Status = 'playing' | 'won' | 'lost'
export type Notice = 'short' | 'unknown' | null

export type WordState = {
  answer: string
  guesses: string[]
  current: string
  status: Status
  /** Why the last Enter was refused, cleared by the next key. */
  notice: Notice
}

/** The word for a seed. The same seed always gives the same word; a date key gives the daily word. */
export const pickAnswer = (seed: string): string => ANSWERS[hashSeed(seed) % ANSWERS.length]

export const isValidWord = (word: string): boolean => VALID.has(word)

export const newGame = (answer: string): WordState => ({ answer, guesses: [], current: '', status: 'playing', notice: null })

/** Marks each letter. Duplicates are handled the standard way: greens first, then yellows while copies remain. */
export function evaluate(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(guess.length).fill('absent')
  const left = new Map<string, number>()
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = 'correct'
    else left.set(answer[i], (left.get(answer[i]) ?? 0) + 1)
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === 'correct') continue
    const n = left.get(guess[i]) ?? 0
    if (n > 0) {
      marks[i] = 'present'
      left.set(guess[i], n - 1)
    }
  }
  return marks
}

export function typeLetter(state: WordState, letter: string): WordState {
  if (state.status !== 'playing' || state.current.length >= LENGTH || !/^[a-z]$/.test(letter)) return state
  return { ...state, current: state.current + letter, notice: null }
}

export function backspace(state: WordState): WordState {
  if (state.status !== 'playing' || state.current.length === 0) return state
  return { ...state, current: state.current.slice(0, -1), notice: null }
}

/** Submits the current row. Too-short or unknown words are refused and cost nothing. */
export function submit(state: WordState): WordState {
  if (state.status !== 'playing') return state
  if (state.current.length < LENGTH) return { ...state, notice: 'short' }
  if (!isValidWord(state.current)) return { ...state, notice: 'unknown' }
  const guesses = [...state.guesses, state.current]
  const status: Status = state.current === state.answer ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing'
  return { ...state, guesses, current: '', status, notice: null }
}

/** The best mark seen for each letter, for coloring the on-screen keyboard. */
export function letterMarks(state: WordState): Record<string, Mark> {
  const rank: Record<Mark, number> = { absent: 0, present: 1, correct: 2 }
  const best: Record<string, Mark> = {}
  for (const guess of state.guesses) {
    evaluate(guess, state.answer).forEach((mark, i) => {
      const letter = guess[i]
      if (!best[letter] || rank[mark] > rank[best[letter]]) best[letter] = mark
    })
  }
  return best
}

/** Fewer guesses score higher; a loss scores nothing. */
export const scoreFor = (state: WordState): number => (state.status === 'won' ? 100 + (MAX_GUESSES - state.guesses.length + 1) * 150 : 0)

const EMOJI: Record<Mark, string> = { correct: '🟩', present: '🟨', absent: '⬛' }

/** A shareable grid with no letters in it, so it does not give the word away. */
export function shareText(state: WordState, label: string): string {
  const rows = state.guesses.map((g) => evaluate(g, state.answer).map((m) => EMOJI[m]).join(''))
  const tries = state.status === 'won' ? `${state.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`
  return [`GoVibeArcadia Daily Word ${label} ${tries}`, ...rows].join('\n')
}
