import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import {
  AI_Y, BALL_R, H, PADDLE_H, PADDLE_W, PLAYER_Y, W, WIN_SCORE,
  movePlayer, newGame, scoreFor, serve, step, type PongState,
} from './pong/rules'

/** Physics runs at a fixed rate, whatever the frame rate. */
const FIXED_MS = 1000 / 120
const MAX_FRAME_MS = 100
const pct = (v: number, of: number) => `${(v / of) * 100}%`

export function NeonPong({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [game, setGameState] = useState<PongState>(() => newGame())
  const [paused, setPaused] = useState(false)
  // Input and the loop read the newest state from a ref that is updated synchronously.
  const current = useRef(game)
  const dir = useRef<-1 | 0 | 1>(0)
  const playedMs = useRef(0)
  const reported = useRef(false)
  const field = useRef<HTMLDivElement>(null)
  const over = game.status === 'won' || game.status === 'lost'

  const setGame = useCallback((next: PongState) => {
    current.current = next
    setGameState(next)
  }, [])

  const report = useCallback(
    (state: PongState) => {
      if (reported.current) return
      reported.current = true
      onFinish({
        score: scoreFor(state),
        durationMs: playedMs.current,
        won: state.status === 'won',
        stats: { points: state.playerScore, conceded: state.aiScore, longestRally: state.longest },
      })
    },
    [onFinish],
  )

  const running = (game.status === 'ready' || game.status === 'playing') && !paused
  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = -1
    let acc = 0
    const frame = (t: number) => {
      if (last >= 0) acc += Math.min(t - last, MAX_FRAME_MS)
      last = t
      let s = current.current
      while (acc >= FIXED_MS && (s.status === 'ready' || s.status === 'playing')) {
        s = step(s, FIXED_MS / 1000, dir.current, random)
        if (s.status === 'playing') playedMs.current += FIXED_MS
        acc -= FIXED_MS
      }
      if (s !== current.current) {
        setGame(s)
        if (s.status === 'won' || s.status === 'lost') report(s)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running, random, report, setGame])

  const doServe = useCallback(() => {
    if (current.current.status === 'ready' && !paused) setGame(serve(current.current, random))
  }, [paused, random, setGame])

  const togglePause = useCallback(() => {
    if (current.current.status === 'playing') setPaused((p) => !p)
  }, [])

  useEffect(() => {
    const onHide = () => {
      if (document.hidden && current.current.status === 'playing') setPaused(true)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        dir.current = -1
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        dir.current = 1
      } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter') {
        if ((e.target as HTMLElement | null)?.closest?.('button')) return
        e.preventDefault()
        if (current.current.status === 'ready') doServe()
        else if (e.key === ' ') togglePause()
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause()
    }
    const onUp = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') && dir.current === -1) dir.current = 0
      if ((e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') && dir.current === 1) dir.current = 0
    }
    const onBlur = () => (dir.current = 0)
    addEventListener('keydown', onDown)
    addEventListener('keyup', onUp)
    addEventListener('blur', onBlur)
    return () => {
      removeEventListener('keydown', onDown)
      removeEventListener('keyup', onUp)
      removeEventListener('blur', onBlur)
    }
  }, [doServe, togglePause])

  const pointerTo = (e: PointerEvent) => {
    const rect = field.current?.getBoundingClientRect()
    if (!rect || rect.width === 0 || paused || !Number.isFinite(e.clientX)) return
    setGame(movePlayer(current.current, ((e.clientX - rect.left) / rect.width) * W))
  }

  const restart = () => {
    // A run abandoned with points still counts once, like the other games.
    if (current.current.playerScore > 0) report(current.current)
    reported.current = false
    playedMs.current = 0
    dir.current = 0
    setPaused(false)
    setGame(newGame())
  }

  return (
    <div className="pong">
      <div className="game-toolbar pong-bar">
        <div>
          <small>You · CPU</small>
          <strong aria-label={`You ${game.playerScore}, computer ${game.aiScore}`}>
            {game.playerScore} : {game.aiScore}
          </strong>
        </div>
        <button onClick={togglePause} disabled={game.status !== 'playing'}>
          {paused ? <Play size={15} /> : <Pause size={15} />}
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button onClick={restart}>
          <RotateCcw size={15} />
          New
        </button>
      </div>
      <div
        ref={field}
        className="pong-field"
        role="group"
        aria-label={`Pong field, first to ${WIN_SCORE}`}
        data-status={paused && game.status === 'playing' ? 'paused' : game.status}
        onPointerMove={pointerTo}
        onPointerDown={(e) => {
          pointerTo(e)
          doServe()
        }}
      >
        <div className="pong-net" />
        <div
          className="pong-paddle ai"
          data-x={Math.round(game.aiX)}
          style={{ left: pct(game.aiX - PADDLE_W / 2, W), top: pct(AI_Y, H), width: pct(PADDLE_W, W), height: pct(PADDLE_H, H) }}
        />
        <div
          className="pong-paddle you"
          data-x={Math.round(game.playerX)}
          style={{ left: pct(game.playerX - PADDLE_W / 2, W), top: pct(PLAYER_Y, H), width: pct(PADDLE_W, W), height: pct(PADDLE_H, H) }}
        />
        <div
          className="pong-ball"
          data-x={Math.round(game.ball.x)}
          data-y={Math.round(game.ball.y)}
          style={{ left: pct(game.ball.x - BALL_R, W), top: pct(game.ball.y - BALL_R, H), width: pct(BALL_R * 2, W), height: pct(BALL_R * 2, H) }}
        />
        {game.status === 'ready' ? <div className="pong-hint">Tap, click or press Space to serve</div> : null}
        {paused && game.status === 'playing' ? <div className="pong-hint">Paused</div> : null}
      </div>
      <p className="game-help">First to {WIN_SCORE}. Mouse or finger moves your paddle (bottom); ←/→ or A/D too.</p>
      {over ? (
        <div className="game-over">
          <h3>{game.status === 'won' ? 'You win!' : 'CPU wins'}</h3>
          <p>
            {game.playerScore} : {game.aiScore} · score {scoreFor(game)}
          </p>
          <button className="primary-btn" onClick={restart}>
            Play again
          </button>
        </div>
      ) : null}
    </div>
  )
}
