import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { highestTile, newGame, step, type Direction, type MergeState } from './merge/state'

const tileClass = (value: number) => (value === 0 ? 'tile-empty' : `tile-${Math.min(value, 2048)}`)

const KEYS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

export function NeonMerge({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [game, setGame] = useState<MergeState>(() => newGame(random))
  const startedAt = useRef(Date.now())
  const reported = useRef(false)

  // Reports a run at most once, from event handlers only (never from a state updater).
  const report = useCallback(
    (state: MergeState) => {
      if (reported.current) return
      reported.current = true
      onFinish({
        score: state.score,
        durationMs: Date.now() - startedAt.current,
        won: highestTile(state.board) >= 2048,
        stats: { highestTile: highestTile(state.board) },
      })
    },
    [onFinish],
  )

  const act = useCallback(
    (dir: Direction) => {
      const next = step(game, dir, random)
      if (next === game) return
      setGame(next)
      if (next.over) report(next)
    },
    [game, random, report],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEYS[e.key]
      if (!dir) return
      e.preventDefault()
      act(dir)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [act])

  const restart = () => {
    // An abandoned run with progress still counts once; a finished run was already reported.
    if (game.score > 0) report(game)
    reported.current = false
    startedAt.current = Date.now()
    setGame(newGame(random))
  }

  return (
    <div className="merge">
      <div className="game-toolbar">
        <div>
          <small>Score</small>
          <strong>{game.score}</strong>
        </div>
        <button onClick={restart}>
          <RotateCcw size={16} />
          New game
        </button>
      </div>
      <div className="merge-board">
        {game.board.flatMap((row, y) =>
          row.map((value, x) => (
            <div className={`merge-tile ${tileClass(value)}`} key={`${y}-${x}`}>
              {value || ''}
            </div>
          )),
        )}
      </div>
      <div className="dpad">
        <button onClick={() => act('up')} aria-label="Up">↑</button>
        <div>
          <button onClick={() => act('left')} aria-label="Left">←</button>
          <button onClick={() => act('down')} aria-label="Down">↓</button>
          <button onClick={() => act('right')} aria-label="Right">→</button>
        </div>
      </div>
      {game.over ? (
        <div className="game-over">
          <h3>Signal lost</h3>
          <p>Final score: {game.score}</p>
          <button className="primary-btn" onClick={restart}>
            Try again
          </button>
        </div>
      ) : null}
    </div>
  )
}
