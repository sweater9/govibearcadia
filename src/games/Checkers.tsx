import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { CheckersBoard } from './checkers/Board'
import { aiStep, interact, isOver, legalSteps, newGame, scoreFor, step, type CState } from './checkers/rules'

/** Pause before the computer answers, so the player can follow each hop. */
const THINK_MS = 500

export function Checkers({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [game, setGame] = useState<CState>(() => newGame())
  const [picked, setPicked] = useState<number | null>(null)
  const startedAt = useRef(0)
  const over = isOver(game)
  const thinking = !over && game.turn === 2

  // A run is reported once, from the handler or timer that ends it, never from a state updater.
  const commit = useCallback(
    (next: CState) => {
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

  // The player's pick follows the multi-capture chain automatically.
  const selected = game.turn === 1 && game.chain !== null ? game.chain : picked

  const click = (i: number) => {
    if (over || thinking) return
    const r = interact(game, 1, selected, i)
    if (r.move) {
      if (game.moves === 0) startedAt.current = Date.now()
      setPicked(null)
      commit(step(game, r.move.from, r.move.to))
    } else setPicked(r.select)
  }

  useEffect(() => {
    if (!thinking) return
    const timer = setTimeout(() => {
      const m = aiStep(game, random)
      if (m) commit(step(game, m.from, m.to))
    }, THINK_MS)
    return () => clearTimeout(timer)
  }, [thinking, game, random, commit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPicked(null)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const targets = useMemo(() => new Set(selected === null || game.turn !== 1 ? [] : legalSteps(game).filter((m) => m.from === selected).map((m) => m.to)), [game, selected])
  const restart = () => {
    setGame(newGame())
    setPicked(null)
  }
  const mustJump = !over && !thinking && legalSteps(game).some((m) => m.captured !== null)
  const status = over ? (game.winner === 1 ? 'You win!' : game.winner === 2 ? 'Computer wins' : 'Draw') : thinking ? 'Computer is thinking…' : game.chain !== null ? 'Keep jumping' : mustJump ? 'Your move: you must capture' : 'Your move'

  return (
    <div className="ck">
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
      <CheckersBoard cells={game.cells} selected={selected} targets={targets} flip={false} disabled={over || thinking} onSquare={click} />
      <p className="game-help">Tap a piece, then a highlighted square (or Tab and Enter). Captures are mandatory and can chain. Reach the far row to crown a king. You are red and go first.</p>
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
