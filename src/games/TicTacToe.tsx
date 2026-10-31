import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { TicTacToeBoard } from './tictactoe/Board'
import { aiMove, isOver, newGame, play, scoreFor, type TState } from './tictactoe/rules'

/** Pause before the computer answers, so the player can follow the game. */
const THINK_MS = 400

export function TicTacToe({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [game, setGame] = useState<TState>(() => newGame())
  const startedAt = useRef(0)
  const over = isOver(game)
  const thinking = !over && game.turn === 2

  // A run is reported once, from the handler or timer that ends it, never from a state updater.
  const commit = useCallback(
    (next: TState) => {
      setGame(next)
      if (isOver(next)) {
        onFinish({
          score: scoreFor(next),
          durationMs: Date.now() - startedAt.current,
          won: next.winner === 1,
          stats: { moves: next.moves, outcome: next.winner === 1 ? 1 : next.winner === 2 ? -1 : 0 },
        })
      }
    },
    [onFinish],
  )

  const mark = useCallback(
    (cell: number) => {
      if (isOver(game) || game.turn !== 1 || game.cells[cell] !== 0) return
      if (game.moves === 0) startedAt.current = Date.now()
      commit(play(game, cell))
    },
    [game, commit],
  )

  useEffect(() => {
    if (!thinking) return
    const timer = setTimeout(() => commit(play(game, aiMove(game, random))), THINK_MS)
    return () => clearTimeout(timer)
  }, [thinking, game, random, commit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= 9) mark(n - 1)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [mark])

  const restart = () => setGame(newGame())
  const status = over ? (game.winner === 1 ? 'You win!' : game.winner === 2 ? 'Computer wins' : 'Draw') : thinking ? 'Computer is thinking…' : 'Your move'

  return (
    <div className="ttt">
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
      <TicTacToeBoard cells={game.cells} line={game.line} disabled={over || thinking} onCell={mark} />
      <p className="game-help">Three in a row wins. Tap a square or press 1–9 (left to right, top to bottom). You are X and go first; the computer is O.</p>
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
