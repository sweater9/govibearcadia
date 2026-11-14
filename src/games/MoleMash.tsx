import { useCallback, useEffect, useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { DURATION, HOLES, newGame, score, start, step, timeLeft, whack, type State } from './mole/rules'
import './mole/mole.css'

const EMOJI = { mole: '🐹', gold: '⭐', bomb: '💣' } as const
const LABEL = { mole: 'Mole', gold: 'Golden mole', bomb: 'Bomb' } as const

export function MoleMash({ onFinish, seed }: GameProps) {
  const [base] = useState(() => seed ?? String(createRandom()()))
  const [run, setRun] = useState(0)
  const [game, setGameState] = useState<State>(() => newGame(base))
  const current = useRef(game)
  const startedAt = useRef(0)
  const reported = useRef(false)
  const finish = useRef(onFinish)
  finish.current = onFinish
  const [best, setBest] = useState(0)

  /** Every transition comes through here, from event handlers or the animation callback, never from a state updater. */
  const apply = useCallback((next: State) => {
    const before = current.current
    if (next === before) return
    current.current = next
    setGameState(next)
    if (before.status === 'ready' && next.status === 'playing') startedAt.current = Date.now()
    if (next.status === 'over' && !reported.current) {
      reported.current = true
      const points = score(next)
      setBest((b) => Math.max(b, points))
      finish.current({ score: points, durationMs: Math.max(0, Date.now() - startedAt.current), won: false, stats: { hits: next.hits, misses: next.misses, bombs: next.bombs } })
    }
  }, [])

  const restart = () => {
    reported.current = false
    const fresh = newGame(run === 0 ? `${base}-1` : `${base}-${run + 1}`)
    current.current = fresh
    setGameState(fresh)
    setRun(run + 1)
  }

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      if (current.current.status === 'playing') apply(step(current.current, dt))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [apply])

  // Number keys 1-9 hit the holes in reading order (1 is top-left), like a phone keypad turned upside down.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[1-9]$/.test(e.key)) apply(whack(current.current, Number(e.key) - 1))
      else if ((e.key === ' ' || e.key === 'Enter') && current.current.status === 'ready') apply(start(current.current))
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [apply])

  const { status } = game
  return (
    <div className="mm">
      <div className="mm-stats">
        <span>Score <b>{score(game)}</b></span>
        <span>Time <b>{Math.ceil(timeLeft(game) / 1000)}s</b></span>
        {best > 0 && <span>Best <b>{best}</b></span>}
      </div>
      <div className="mm-board" data-status={status}>
        <div className="mm-grid">
          {Array.from({ length: HOLES }, (_, i) => {
            const pop = game.holes[i]
            return (
              <button key={i} type="button" className="mm-hole" data-kind={pop?.kind ?? 'empty'} aria-label={pop ? `${LABEL[pop.kind]}, hole ${i + 1}` : `Hole ${i + 1}`}
                onPointerDown={(e) => { e.preventDefault(); apply(whack(current.current, i)) }} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation() }}>
                {pop && <span className="mm-pop" aria-hidden="true">{EMOJI[pop.kind]}</span>}
              </button>
            )
          })}
        </div>
        {status !== 'playing' && (
          <div className="mm-over" role="status">
            {status === 'ready' ? (
              <>
                <strong>Mole Mash</strong>
                <span>Tap the moles before they duck. Stars are worth triple. Leave the bombs alone. Keys 1 to 9 work too. {DURATION / 1000} seconds.</span>
                <button type="button" className="primary-btn" onClick={() => apply(start(current.current))}>Start</button>
              </>
            ) : (
              <>
                <strong>Time's up!</strong>
                <span>Score {score(game)} · {game.hits} whacked · {game.misses} got away</span>
                <button type="button" className="primary-btn" onClick={restart}>Play again</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
