import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { begin, newGame, score, step, tickMs, turn, type Dir, type Point, type SnakeState } from './snake/rules'

const KEYS: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  W: 'up',
  s: 'down',
  S: 'down',
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right',
}

/** Minimum finger travel, in pixels, to count as a swipe. */
const SWIPE_MIN = 24

export function NeonSnake({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [game, setGame] = useState<SnakeState>(() => newGame(random))
  const [paused, setPaused] = useState(false)
  const playedMs = useRef(0)
  const reported = useRef(false)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const { cols, rows } = game
  const over = game.status === 'over' || game.status === 'won'

  const report = useCallback(
    (state: SnakeState) => {
      if (reported.current) return
      reported.current = true
      onFinish({
        score: score(state),
        durationMs: playedMs.current,
        won: state.status === 'won',
        stats: { length: state.snake.length, food: state.eaten },
      })
    },
    [onFinish],
  )

  // The newest state, readable from timer callbacks without making the timer depend on it.
  const latest = useRef(game)
  useEffect(() => {
    latest.current = game
  })

  // The game loop: one timeout per move. The pure `step` runs here, in a timer callback, never inside
  // a state updater, so the seeded random stream is consumed exactly once per move even in StrictMode.
  // The timer is restarted only when the snake has moved (or status, speed or pause change). A turn
  // queued mid-tick changes `game` but must not restart the countdown, so the callback reads the
  // latest state, including the queue, from the ref instead.
  const delay = tickMs(game)
  useEffect(() => {
    if (game.status !== 'playing' || paused) return
    const timer = setTimeout(() => {
      const next = step(latest.current, random)
      playedMs.current += delay
      setGame(next)
      if (next.status === 'over' || next.status === 'won') report(next)
    }, delay)
    return () => clearTimeout(timer)
  }, [game.status, game.snake, delay, paused, random, report])

  // Switching tabs pauses a running game rather than letting the snake crash unseen.
  useEffect(() => {
    if (game.status !== 'playing') return
    const onHide = () => {
      if (document.hidden) setPaused(true)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [game.status])

  const input = useCallback(
    (dir: Dir) => {
      if (!paused) setGame((g) => begin(turn(g, dir))) // pure: safe inside an updater
    },
    [paused],
  )

  const toggle = useCallback(() => {
    if (game.status === 'ready') setGame(begin)
    else if (game.status === 'playing') setPaused((p) => !p)
  }, [game.status])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEYS[e.key]
      if (dir) {
        e.preventDefault()
        input(dir)
      } else if ((e.key === ' ' || e.key === 'p' || e.key === 'P') && !(e.target as HTMLElement | null)?.closest?.('button')) {
        e.preventDefault() // a focused button already toggles itself on Space
        toggle()
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [input, toggle])

  const restart = () => {
    // Like Neon Merge: a run abandoned with a score still counts once.
    if (score(game) > 0) report(game)
    reported.current = false
    playedMs.current = 0
    setPaused(false)
    setGame(newGame(random))
  }

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    swipeStart.current = t ? { x: t.clientX, y: t.clientY } : null
  }
  const onTouchEnd = (e: TouchEvent) => {
    const from = swipeStart.current
    swipeStart.current = null
    const t = e.changedTouches[0]
    if (!from || !t) return
    const dx = t.clientX - from.x
    const dy = t.clientY - from.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return
    input(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
  }

  const cell = (p: Point): CSSProperties => ({
    left: `${(p.x / cols) * 100}%`,
    top: `${(p.y / rows) * 100}%`,
    width: `${100 / cols}%`,
    height: `${100 / rows}%`,
  })

  const action = game.status === 'ready' ? 'Start' : paused ? 'Resume' : 'Pause'

  return (
    <div className="snake">
      <div className="game-toolbar snake-bar">
        <div>
          <small>Score</small>
          <strong>{score(game)}</strong>
        </div>
        <button onClick={toggle} disabled={over}>
          {action === 'Pause' ? <Pause size={15} /> : <Play size={15} />}
          {action}
        </button>
        <button onClick={restart}>
          <RotateCcw size={15} />
          New
        </button>
      </div>
      <div
        className="snake-board"
        role="group"
        aria-label={`Snake board, length ${game.snake.length}`}
        data-status={paused && game.status === 'playing' ? 'paused' : game.status}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {game.food ? <div className="snake-food" data-x={game.food.x} data-y={game.food.y} style={cell(game.food)} /> : null}
        {game.snake.map((p, i) => (
          <div
            key={i}
            className={`snake-seg ${i === 0 ? 'head' : ''}`}
            data-x={p.x}
            data-y={p.y}
            style={cell(p)}
          />
        ))}
        {game.status === 'ready' ? <div className="snake-hint">Press an arrow key or WASD, swipe, or tap Start</div> : null}
        {paused && game.status === 'playing' ? <div className="snake-hint">Paused</div> : null}
      </div>
      <div className="dpad">
        <button onClick={() => input('up')} aria-label="Up">↑</button>
        <div>
          <button onClick={() => input('left')} aria-label="Left">←</button>
          <button onClick={() => input('down')} aria-label="Down">↓</button>
          <button onClick={() => input('right')} aria-label="Right">→</button>
        </div>
      </div>
      {over ? (
        <div className="game-over">
          <h3>{game.status === 'won' ? 'Board cleared!' : 'Crashed'}</h3>
          <p>Final score: {score(game)}</p>
          <button className="primary-btn" onClick={restart}>
            Play again
          </button>
        </div>
      ) : null}
    </div>
  )
}
