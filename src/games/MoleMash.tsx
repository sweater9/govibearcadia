import { useCallback, useEffect, useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { DURATION, HOLES, LIVES, SWITCH_MS, newGame, multiplier, score, start, step, switchIn, timeLeft, whack, type Colour, type State } from './mole/rules'
import './mole/mole.css'

const EMOJI = { mole: '🐹', gold: '⭐', bomb: '💣' } as const
const LABEL = { mole: 'Mole', gold: 'Golden mole', bomb: 'Bomb' } as const
// A symbol as well as a colour, so the target can be told apart without seeing colour.
const SHAPE: Record<Colour, string> = { red: '▲', blue: '●', green: '■' }
const NAME: Record<Colour, string> = { red: 'Red', blue: 'Blue', green: 'Green' }

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
      finish.current({ score: points, durationMs: Math.max(0, Date.now() - startedAt.current), won: false, stats: { hits: next.hits, misses: next.misses, bombs: next.bombs, wrong: next.wrong, bestStreak: next.bestStreak, lives: next.lives } })
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
        <span aria-label={`${game.lives} of ${LIVES} lives`}>Lives <b data-testid="mm-lives">{'♥'.repeat(game.lives)}{'♡'.repeat(LIVES - game.lives)}</b></span>
        <span>Streak <b data-testid="mm-streak">{game.streak}</b> <b className="mm-mult" data-testid="mm-mult">×{multiplier(game.streak)}</b></span>
        {best > 0 && <span>Best <b>{best}</b></span>}
      </div>
      <div className="mm-target" data-colour={game.target} data-testid="mm-target" role="status" aria-live="polite">
        <span className="mm-chip" aria-hidden="true">{SHAPE[game.target]}</span>
        <span>Whack <b>{NAME[game.target]}</b> only</span>
        <i className="mm-timer" aria-hidden="true" style={{ width: `${status === 'playing' ? (switchIn(game) / SWITCH_MS) * 100 : 100}%` }} />
      </div>
      <div className="mm-board" data-status={status}>
        <div className="mm-grid">
          {Array.from({ length: HOLES }, (_, i) => {
            const pop = game.holes[i]
            return (
              <button key={i} type="button" className="mm-hole" data-kind={pop?.kind ?? 'empty'} data-colour={pop && pop.kind !== 'bomb' ? pop.colour : undefined} aria-label={pop ? `${pop.kind === 'bomb' ? '' : `${NAME[pop.colour]} `}${LABEL[pop.kind]}, hole ${i + 1}` : `Hole ${i + 1}`}
                onPointerDown={(e) => { e.preventDefault(); apply(whack(current.current, i)) }} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation() }}>
                {pop && <span className="mm-pop" aria-hidden="true">{EMOJI[pop.kind]}</span>}
                {pop && pop.kind !== 'bomb' && <span className="mm-badge" aria-hidden="true">{SHAPE[pop.colour]}</span>}
              </button>
            )
          })}
        </div>
        {status !== 'playing' && (
          <div className="mm-over" role="status">
            {status === 'ready' ? (
              <>
                <strong>Mole Mash</strong>
                <span>Only whack moles in the target colour; it changes every {SWITCH_MS / 1000} seconds. Hits in a row raise your multiplier. A wrong colour or a bomb costs a life, and you have {LIVES}. Stars are worth triple. Keys 1 to 9 work too. {DURATION / 1000} seconds.</span>
                <button type="button" className="primary-btn" onClick={() => apply(start(current.current))}>Start</button>
              </>
            ) : (
              <>
                <strong>{game.reason === 'lives' ? 'Out of lives!' : "Time's up!"}</strong>
                <span>Score {score(game)} · {game.hits} whacked · best streak {game.bestStreak}</span>
                <button type="button" className="primary-btn" onClick={restart}>Play again</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
