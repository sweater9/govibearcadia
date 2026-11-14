import { useCallback, useEffect, useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { CAR_H, LANES, PLAYER_TOP, move, newGame, score, speedAt, start, step, type State } from './traffic/rules'
import './traffic/traffic.css'

const TINTS = ['#ff7a59', '#ffd166', '#9b8cff', '#5eead4', '#f472b6']

export function TrafficDodger({ onFinish, seed }: GameProps) {
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
    if (next.status === 'crashed' && !reported.current) {
      reported.current = true
      const points = score(next)
      setBest((b) => Math.max(b, points))
      finish.current({ score: points, durationMs: Math.max(0, Date.now() - startedAt.current), won: false, stats: { distance: Math.floor(next.distance), passed: next.passed } })
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (k === 'arrowleft' || k === 'a') apply(move(current.current, -1))
      else if (k === 'arrowright' || k === 'd') apply(move(current.current, 1))
      else if ((k === ' ' || k === 'enter') && current.current.status === 'ready') apply(start(current.current))
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [apply])

  const { status, lane, cars } = game
  const speed = speedAt(game.distance)
  return (
    <div className="tr">
      <div className="tr-stats">
        <span>Score <b aria-live="off">{score(game)}</b></span>
        <span>Speed <b>{Math.round(speed * 1.6)} km/h</b></span>
        {best > 0 && <span>Best <b>{best}</b></span>}
      </div>
      <div
        className="tr-field"
        data-status={status}
        data-lane={lane}
        style={{ '--lanes': LANES, '--road': `${(game.distance * 4) % 100}%` } as React.CSSProperties}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          const box = e.currentTarget.getBoundingClientRect()
          apply(move(current.current, e.clientX < box.left + box.width / 2 ? -1 : 1))
        }}
      >
        {cars.map((c) => <span key={c.id} className="tr-car" style={{ left: `${(c.lane * 100) / LANES}%`, top: `${c.y}%`, height: `${CAR_H}%`, '--tint': TINTS[c.id % TINTS.length] } as React.CSSProperties} />)}
        <span className="tr-car tr-me" role="img" aria-label={`Your car, lane ${lane + 1} of ${LANES}`} style={{ left: `${(lane * 100) / LANES}%`, top: `${PLAYER_TOP}%`, height: `${CAR_H}%` }} />
        {status !== 'playing' && (
          <div className="tr-over" role="status">
            {status === 'ready' ? (
              <>
                <strong>Traffic Dodger</strong>
                <span>Switch lanes to avoid the cars. Left and right keys, or tap the sides.</span>
                <button type="button" className="primary-btn" onClick={() => apply(start(current.current))}>Start</button>
              </>
            ) : (
              <>
                <strong>Crash!</strong>
                <span>Score {score(game)} · {Math.floor(game.distance)} m · {game.passed} cars passed</span>
                <button type="button" className="primary-btn" onClick={restart}>Play again</button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="tr-pad">
        <button type="button" aria-label="Move left" onPointerDown={(e) => { e.stopPropagation(); apply(move(current.current, -1)) }} onKeyDown={(e) => e.stopPropagation()}>◀</button>
        <button type="button" aria-label="Move right" onPointerDown={(e) => { e.stopPropagation(); apply(move(current.current, 1)) }} onKeyDown={(e) => e.stopPropagation()}>▶</button>
      </div>
    </div>
  )
}
