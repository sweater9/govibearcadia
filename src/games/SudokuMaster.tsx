import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Eraser, Pencil, RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import {
  PEERS, conflicts, erase, isGiven, newGame, noteDigits, place, scoreFor, toggleNote,
  type Difficulty, type SudokuState,
} from './sudoku/rules'

const LEVELS: Difficulty[] = ['easy', 'medium', 'hard']
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function SudokuMaster({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [game, setGameState] = useState<SudokuState>(() => newGame(random, 'medium'))
  const [selected, setSelected] = useState<number | null>(null)
  const [pencil, setPencil] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const startedAt = useRef(0)
  // Key handling reads the newest state from a ref that is updated synchronously.
  const current = useRef(game)
  const cells = useRef(new Map<number, HTMLButtonElement>())
  const won = game.status === 'won'

  const setGame = useCallback((next: SudokuState) => {
    current.current = next
    setGameState(next)
  }, [])

  // Clock display only; it never touches game state.
  useEffect(() => {
    if (won) return
    const timer = setInterval(() => {
      if (startedAt.current) setSeconds(Math.floor((Date.now() - startedAt.current) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [won, game.difficulty])

  const begin = () => {
    if (!startedAt.current) startedAt.current = Date.now()
  }

  const enter = useCallback(
    (d: number) => {
      const s = current.current
      if (selected === null || s.status === 'won') return
      begin()
      const next = pencil ? toggleNote(s, selected, d) : place(s, selected, d)
      if (next === s) return
      setGame(next)
      if (next.status === 'won') {
        const elapsed = Date.now() - startedAt.current
        setSeconds(Math.floor(elapsed / 1000))
        onFinish({
          score: scoreFor(next, elapsed / 1000),
          durationMs: elapsed,
          won: true,
          stats: { mistakes: next.mistakes, difficulty: LEVELS.indexOf(next.difficulty) + 1 },
        })
      }
    },
    [selected, pencil, onFinish, setGame],
  )

  const clear = useCallback(() => {
    if (selected !== null) setGame(erase(current.current, selected))
  }, [selected, setGame])

  const deal = (difficulty: Difficulty) => {
    startedAt.current = 0
    setSeconds(0)
    setSelected(null)
    setGame(newGame(random, difficulty))
  }

  const focusCell = (i: number) => {
    setSelected(i)
    cells.current.get(i)?.focus()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (/^[1-9]$/.test(e.key)) enter(Number(e.key))
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') clear()
      else if (e.key === 'n' || e.key === 'N') setPencil((p) => !p)
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const from = selected ?? 0
        const r = Math.floor(from / 9)
        const c = from % 9
        const nr = Math.min(8, Math.max(0, r + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0)))
        const nc = Math.min(8, Math.max(0, c + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0)))
        focusCell(nr * 9 + nc)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const bad = useMemo(() => conflicts(game.cells), [game.cells])
  const peers = selected === null ? null : new Set(PEERS[selected])
  const selectedValue = selected === null ? 0 : game.cells[selected]
  const counts = useMemo(() => {
    const n = Array<number>(10).fill(0)
    game.cells.forEach((v, i) => {
      if (v && v === game.solution[i]) n[v]++
    })
    return n
  }, [game.cells, game.solution])

  return (
    <div className="sdk">
      <div className="game-toolbar sdk-bar">
        <div>
          <small>Time</small>
          <strong aria-label={`Time ${fmt(seconds)}`}>{fmt(seconds)}</strong>
        </div>
        <div>
          <small>Mistakes</small>
          <strong aria-label={`Mistakes ${game.mistakes}`}>✗ {game.mistakes}</strong>
        </div>
        <select
          aria-label="Difficulty"
          value={game.difficulty}
          onChange={(e) => deal(e.target.value as Difficulty)}
        >
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <button onClick={() => setPencil((p) => !p)} aria-pressed={pencil} aria-label="Pencil notes" title="Notes (N)">
          <Pencil size={15} />
        </button>
        <button onClick={clear} aria-label="Erase" title="Erase">
          <Eraser size={15} />
        </button>
        <button onClick={() => deal(game.difficulty)} aria-label="New puzzle" title="New puzzle">
          <RotateCcw size={15} />
        </button>
      </div>
      <div className="sdk-grid" role="grid" aria-label={`Sudoku, ${game.difficulty}`}>
        {game.cells.map((v, i) => {
          const given = isGiven(game, i)
          const notes = noteDigits(game.notes[i])
          const classes = [
            'sdk-cell',
            peers?.has(i) ? 'peer' : '',
            selectedValue && v === selectedValue ? 'same' : '',
          ].join(' ')
          return (
            <button
              key={i}
              ref={(el) => {
                if (el) cells.current.set(i, el)
                else cells.current.delete(i)
              }}
              role="gridcell"
              className={classes}
              data-i={i}
              data-v={v || undefined}
              data-given={given || undefined}
              data-conflict={bad.has(i) || undefined}
              data-selected={selected === i || undefined}
              tabIndex={(selected ?? 0) === i ? 0 : -1}
              onClick={() => setSelected(i)}
              aria-label={`Row ${Math.floor(i / 9) + 1}, column ${(i % 9) + 1}, ${v ? v : notes.length ? `notes ${notes.join(' ')}` : 'empty'}${given ? ', given' : ''}`}
            >
              {v ? (
                v
              ) : notes.length ? (
                <span className="sdk-notes" aria-hidden="true">
                  {Array.from({ length: 9 }, (_, k) => (
                    <i key={k}>{notes.includes(k + 1) ? k + 1 : ''}</i>
                  ))}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <div className="sdk-pad">
        {Array.from({ length: 9 }, (_, k) => (
          <button key={k} onClick={() => enter(k + 1)} disabled={counts[k + 1] >= 9} aria-label={`Enter ${k + 1}`}>
            {k + 1}
          </button>
        ))}
      </div>
      {won ? (
        <div className="game-over">
          <h3>Solved!</h3>
          <p>
            {fmt(seconds)} · {game.mistakes} mistake{game.mistakes === 1 ? '' : 's'} · score {scoreFor(game, seconds)}
          </p>
          <button className="primary-btn" onClick={() => deal(game.difficulty)}>
            Play again
          </button>
        </div>
      ) : null}
    </div>
  )
}
