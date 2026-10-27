import { useEffect, useMemo, useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'

const DURATION = 30
const POINTS_PER_HIT = 100

export function PulseTap({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(DURATION)
  const [score, setScore] = useState(0)
  const [pos, setPos] = useState({ x: 50, y: 50 })
  const scoreRef = useRef(0)

  // The clock only ticks; it never has side effects inside the state updater.
  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => setTime((t) => Math.max(0, t - 1)), 1000)
    return () => clearInterval(timer)
  }, [playing])

  // Finishing is its own effect, so a run is reported exactly once when time reaches zero.
  useEffect(() => {
    if (!playing || time > 0) return
    setPlaying(false)
    onFinish({
      score: scoreRef.current,
      durationMs: DURATION * 1000,
      stats: { hits: scoreRef.current / POINTS_PER_HIT },
    })
  }, [playing, time, onFinish])

  const start = () => {
    scoreRef.current = 0
    setScore(0)
    setTime(DURATION)
    setPlaying(true)
    setPos({ x: 50, y: 50 })
  }

  const hit = () => {
    scoreRef.current += POINTS_PER_HIT
    setScore(scoreRef.current)
    setPos({ x: 8 + random() * 80, y: 12 + random() * 72 })
  }

  return (
    <div className="pulse-game">
      <div className="game-toolbar">
        <div>
          <small>Score</small>
          <strong>{score}</strong>
        </div>
        <div>
          <small>Time</small>
          <strong>{time}s</strong>
        </div>
      </div>
      <div className="pulse-field">
        {playing ? (
          <button className="target" style={{ left: `${pos.x}%`, top: `${pos.y}%` }} onClick={hit} aria-label="Tap target">
            <span />
          </button>
        ) : (
          <div className="pulse-start">
            <div className="target preview">
              <span />
            </div>
            <h3>{time === 0 ? 'Run complete' : 'Ready to pulse?'}</h3>
            <p>{time === 0 ? `You scored ${score}.` : 'Hit as many signals as you can in 30 seconds.'}</p>
            <button className="primary-btn" onClick={start}>
              {time === 0 ? 'Play again' : 'Start run'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
