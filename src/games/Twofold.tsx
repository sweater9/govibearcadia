import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, Shuffle } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { SIZES, conflicts, cycle, newGame, reset, scoreFor, type Size, type TwofoldState } from './twofold/rules'

const GLYPH = ['☀', '☾'] as const

export function Twofold({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [size, setSize] = useState<Size>(6)
  const [game, setGameState] = useState<TwofoldState>(() => newGame(6, random))
  const [seconds, setSeconds] = useState(0)
  const current = useRef(game)
  const startedAt = useRef(0)
  const finish = useRef(onFinish)
  finish.current = onFinish

  const setGame = useCallback((next: TwofoldState) => {
    const before = current.current
    if (next === before) return
    if (startedAt.current === 0) startedAt.current = Date.now()
    current.current = next
    setGameState(next)
    if (next.status === 'won' && before.status !== 'won') {
      const elapsed = Date.now() - startedAt.current
      setSeconds(Math.floor(elapsed / 1000))
      finish.current({ score: scoreFor(elapsed / 1000), durationMs: elapsed, won: true, stats: { size: next.puzzle.size } })
    }
  }, [])

  const started = startedAt.current !== 0
  useEffect(() => {
    if (game.status !== 'playing' || !started) return
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [game.status, started])

  const deal = (n: Size) => {
    startedAt.current = 0
    setSeconds(0)
    setSize(n)
    const g = newGame(n, random)
    current.current = g
    setGameState(g)
  }

  const n = game.puzzle.size
  const bad = conflicts(n, game.cells)

  return (
    <div className="tf">
      <div className="game-toolbar tf-bar">
        <div>
          <small>Time</small>
          <strong>{seconds}</strong>
        </div>
        <select aria-label="Size" value={size} onChange={(e) => deal(Number(e.target.value) as Size)}>
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s}×{s}
            </option>
          ))}
        </select>
        <button aria-label="Reset" onClick={() => setGame(reset(current.current))}>
          <RotateCcw size={15} />
        </button>
        <button aria-label="New puzzle" onClick={() => deal(size)}>
          <Shuffle size={15} />
        </button>
      </div>
      <div className="tf-board" role="group" aria-label={`Twofold ${n} by ${n}`} style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, ['--gn' as string]: n }}>
        {game.cells.map((v, i) => {
          const locked = game.puzzle.given[i] !== -1
          return (
            <button
              key={i}
              data-cell={i}
              className={`tf-cell ${locked ? 'given' : ''} ${bad.has(i) ? 'bad' : ''} s${v}`}
              aria-label={`Row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}: ${v === -1 ? 'empty' : v === 0 ? 'sun' : 'moon'}${locked ? ', fixed' : ''}${bad.has(i) ? ', breaks a rule' : ''}`}
              aria-disabled={locked || undefined}
              onClick={() => setGame(cycle(current.current, i))}
            >
              {v === -1 ? '' : GLYPH[v]}
            </button>
          )
        })}
      </div>
      <p className="tf-hint">Tap to cycle ☀ · ☾ · empty. No three alike in a row or column, and each row and column has equally many ☀ and ☾.</p>
      {game.status === 'won' ? (
        <div className="win-message" role="status">
          Solved in {seconds}s! Score {scoreFor(seconds)}
          <button className="gf-next" onClick={() => deal(size)}>
            New puzzle
          </button>
        </div>
      ) : null}
    </div>
  )
}
