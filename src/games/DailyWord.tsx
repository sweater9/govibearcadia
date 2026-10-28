import { useCallback, useEffect, useRef, useState } from 'react'
import { Delete } from 'lucide-react'
import { createRandom, dailySeed } from '../lib/rng'
import type { GameProps } from '../types'
import {
  LENGTH,
  MAX_GUESSES,
  backspace,
  evaluate,
  letterMarks,
  newGame,
  pickAnswer,
  scoreFor,
  shareText,
  submit,
  typeLetter,
  type Notice,
  type WordState,
} from './wordle/rules'
import { ANSWERS } from './wordle/words'

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const NOTICES: Record<Exclude<Notice, null>, string> = { short: 'Not enough letters', unknown: 'Not in the word list' }

export function DailyWord({ onFinish, seed }: GameProps) {
  // With no seed the word is today's word (UTC), the same for everyone. `?seed=` picks any other word.
  const key = seed ?? dailySeed()
  const [game, setGameState] = useState<WordState>(() => newGame(pickAnswer(key)))
  const [practice, setPractice] = useState(false)
  const [copied, setCopied] = useState(false)
  const startedAt = useRef(0)
  // Fast typists can fire several keys before React re-renders, so key handling reads the newest
  // state from a ref that is updated synchronously, rather than from a possibly stale closure.
  const current = useRef(game)
  const isPractice = useRef(false)
  const setGame = useCallback((next: WordState) => {
    current.current = next
    setGameState(next)
  }, [])

  const press = useCallback(
    (k: string) => {
      const game = current.current
      if (game.status !== 'playing') return
      if (k === 'Enter') {
        const next = submit(game)
        setGame(next)
        if (next.status !== 'playing') {
          onFinish({
            score: scoreFor(next),
            durationMs: Date.now() - startedAt.current,
            won: next.status === 'won',
            stats: { guesses: next.guesses.length, daily: isPractice.current ? 0 : 1 },
          })
        }
        return
      }
      if (game.current === '' && game.guesses.length === 0 && k !== 'Backspace') startedAt.current = Date.now()
      setGame(k === 'Backspace' ? backspace(game) : typeLetter(game, k))
    },
    [onFinish, setGame],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const onButton = (e.target as HTMLElement | null)?.closest?.('button')
      if (e.key === 'Enter') {
        if (onButton) return // a focused button activates itself
        e.preventDefault()
        press('Enter')
      } else if (e.key === 'Backspace') press('Backspace')
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase())
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [press])

  const startPractice = () => {
    const random = createRandom() // a practice word is deliberately not the daily word
    setGame(newGame(ANSWERS[Math.floor(random() * ANSWERS.length)]))
    isPractice.current = true
    setPractice(true)
    setCopied(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText(game, practice ? 'practice' : key))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const marks = letterMarks(game)
  const over = game.status !== 'playing'
  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => {
    if (r < game.guesses.length) {
      const word = game.guesses[r]
      const m = evaluate(word, game.answer)
      return [...word].map((ch, c) => ({ ch, state: m[c] as string }))
    }
    if (r === game.guesses.length && !over) {
      return Array.from({ length: LENGTH }, (_, c) => ({ ch: game.current[c] ?? '', state: game.current[c] ? 'typed' : 'empty' }))
    }
    return Array.from({ length: LENGTH }, () => ({ ch: '', state: 'empty' }))
  })

  return (
    <div className="wordle">
      <p className="wordle-notice" role="status" aria-live="polite">
        {game.notice ? NOTICES[game.notice] : practice ? 'Practice word' : seed !== undefined ? `Seeded word · ${key}` : `Word of the day · ${key}`}
      </p>
      <div className="wordle-grid" role="grid" aria-label="Guesses">
        {rows.map((row, r) => (
          <div key={r} className="wordle-row" role="row" data-row={r}>
            {row.map((tile, c) => (
              <div key={c} className="wordle-tile" role="gridcell" data-state={tile.state} data-r={r} data-c={c}>
                {tile.ch}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="wordle-kb" aria-label="Keyboard">
        {ROWS.map((letters, i) => (
          <div key={i} className="wordle-kbrow">
            {i === 2 ? (
              <button className="wide" data-key="Enter" onMouseDown={(e) => e.preventDefault()} onClick={() => press('Enter')}>
                Enter
              </button>
            ) : null}
            {[...letters].map((l) => (
              <button
                key={l}
                data-key={l}
                data-mark={marks[l]}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => press(l)}
                aria-label={l.toUpperCase()}
              >
                {l}
              </button>
            ))}
            {i === 2 ? (
              <button className="wide" data-key="Backspace" aria-label="Delete" onMouseDown={(e) => e.preventDefault()} onClick={() => press('Backspace')}>
                <Delete size={16} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      {over ? (
        <div className="game-over">
          <h3>{game.status === 'won' ? 'Got it!' : 'Out of guesses'}</h3>
          <p>
            {game.status === 'won' ? `${game.guesses.length} of ${MAX_GUESSES} · score ${scoreFor(game)}` : `The word was ${game.answer.toUpperCase()}`}
          </p>
          <button className="secondary-btn" onClick={copy}>
            {copied ? 'Copied!' : 'Copy result'}
          </button>
          <button className="primary-btn" style={{ marginTop: 10 }} onClick={startPractice}>
            Practice another word
          </button>
        </div>
      ) : null}
    </div>
  )
}
