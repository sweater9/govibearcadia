import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { COLS, ROWS, aiMove, dropRow, drop, isOver, newGame, scoreFor, type C4State } from './connect4/rules'

/** Pause before the computer answers, so the player can follow the game. */
const THINK_MS = 450

export function ConnectFour({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [game, setGame] = useState<C4State>(() => newGame())
  const startedAt = useRef(0)
  const over = isOver(game)
  const thinking = !over && game.turn === 2

  // A run is reported once, from the handler or timer that ends it, never from a state updater.
  const commit = useCallback(
    (next: C4State) => {
      setGame(next)
      if (isOver(next)) {
        onFinish({
          score: scoreFor(next),
          durationMs: Date.now() - startedAt.current,
          won: next.winner === 1,
          stats: { moves: next.moves, outcome: next.winner === 1 ? 1 : next.winner === 2 ? -1 : 0 }, // outcome: 1 win, -1 loss, 0 draw
        })
      }
    },
    [onFinish],
  )

  const play = useCallback(
    (col: number) => {
      if (isOver(game) || game.turn !== 1 || dropRow(game.cells, col) < 0) return
      if (game.moves === 0) startedAt.current = Date.now()
      commit(drop(game, col))
    },
    [game, commit],
  )

  // The computer's turn: one timer per position. `aiMove` draws from the seeded stream here, outside any updater.
  useEffect(() => {
    if (!thinking) return
    const timer = setTimeout(() => commit(drop(game, aiMove(game, random))), THINK_MS)
    return () => clearTimeout(timer)
  }, [thinking, game, random, commit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= COLS) play(n - 1)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [play])

  const restart = () => setGame(newGame())

  const status = over
    ? game.winner === 1
      ? 'You win!'
      : game.winner === 2
        ? 'Computer wins'
        : 'Draw'
    : thinking
      ? 'Computer is thinking…'
      : 'Your move'

  return (
    <div className="c4">
      <div className="game-toolbar c4-bar">
        <div>
          <small>Turn</small>
          <strong className="c4-status" aria-live="polite">
            {status}
          </strong>
        </div>
        <button onClick={restart}>
          <RotateCcw size={15} />
          New
        </button>
      </div>
      <div className="c4-board" data-over={over} data-thinking={thinking}>
        <div className="c4-grid" aria-hidden="true">
          {game.cells.map((p, i) => (
            <div
              key={i}
              className="c4-cell"
              data-r={Math.floor(i / COLS)}
              data-c={i % COLS}
              data-p={p}
              data-win={game.line?.includes(i) ? 'true' : undefined}
            />
          ))}
        </div>
        <div className="c4-cols">
          {Array.from({ length: COLS }, (_, c) => (
            <button
              key={c}
              data-col={c}
              onClick={() => play(c)}
              disabled={over || thinking || dropRow(game.cells, c) < 0}
              aria-label={`Drop in column ${c + 1}`}
            />
          ))}
        </div>
      </div>
      <p className="game-help">
        Four in a row wins. Click a column or press 1–{COLS}. You are {'●'} red; the computer answers. {ROWS * COLS - game.moves} cells left.
      </p>
      {over ? (
        <div className="game-over">
          <h3>{status}</h3>
          <p>
            {game.moves} moves · score {scoreFor(game)}
          </p>
          <button className="primary-btn" onClick={restart}>
            Play again
          </button>
        </div>
      ) : null}
    </div>
  )
}

