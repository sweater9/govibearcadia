import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, Undo2 } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { CAPACITY, TUBES, canMove, isSolved, move, newGame, scoreFor, undo, type SortState } from './colorsort/rules'

// A symbol on every ball so the colors are not the only cue.
const SYMBOLS = ['●', '▲', '■', '◆', '★', '✚']

export function ColorSort({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [game, setGame] = useState<SortState>(() => newGame(random))
  const [picked, setPicked] = useState<number | null>(null)
  const startedAt = useRef(0)
  const solved = isSolved(game.tubes)

  const press = useCallback(
    (index: number) => {
      if (solved) return
      if (picked === null) {
        if (game.tubes[index].length > 0) setPicked(index)
        return
      }
      if (picked === index) return setPicked(null)
      if (!canMove(game.tubes, picked, index)) {
        setPicked(game.tubes[index].length > 0 ? index : null) // a bad target just changes the pick
        return
      }
      if (game.moves.length === 0) startedAt.current = Date.now()
      const next = move(game, picked, index)
      setGame(next)
      setPicked(null)
      if (isSolved(next.tubes)) {
        onFinish({
          score: scoreFor(next),
          durationMs: Date.now() - startedAt.current,
          won: true,
          stats: { moves: next.moves.length },
        })
      }
    },
    [game, picked, solved, onFinish],
  )

  const takeBack = useCallback(() => {
    if (solved) return
    setGame((g) => undo(g)) // pure: safe inside an updater
    setPicked(null)
  }, [solved])

  const restart = () => {
    setGame(newGame(random))
    setPicked(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= TUBES) press(n - 1)
      else if (e.key === 'Escape') setPicked(null)
      else if (e.key === 'u' || e.key === 'U' || e.key === 'z' || e.key === 'Z') takeBack()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [press, takeBack])

  return (
    <div className="csort">
      <div className="game-toolbar csort-bar">
        <div>
          <small>Moves</small>
          <strong>{game.moves.length}</strong>
        </div>
        <button onClick={takeBack} disabled={game.moves.length === 0 || solved}>
          <Undo2 size={15} />
          Undo
        </button>
        <button onClick={restart}>
          <RotateCcw size={15} />
          New
        </button>
      </div>
      <div className="csort-tubes" role="group" aria-label="Tubes">
        {game.tubes.map((tube, i) => {
          const top = tube.length ? tube[tube.length - 1] : null
          return (
            <button
              key={i}
              className="csort-tube"
              data-i={i}
              data-selected={picked === i}
              onClick={() => press(i)}
              aria-pressed={picked === i}
              aria-label={`Tube ${i + 1}, ${tube.length ? `${tube.length} of ${CAPACITY}, top ${SYMBOLS[top!]} color ${top! + 1}` : 'empty'}`}
            >
              {tube.map((ball, b) => (
                <span key={b} className="csort-ball" data-color={ball} aria-hidden="true">
                  {SYMBOLS[ball]}
                </span>
              ))}
            </button>
          )
        })}
      </div>
      <p className="game-help">Pick a tube, then where to pour one ball. Keys 1–8 pick a tube, U undoes.</p>
      {solved ? (
        <div className="game-over">
          <h3>Sorted!</h3>
          <p>
            {game.moves.length} moves · score {scoreFor(game)}
          </p>
          <button className="primary-btn" onClick={restart}>
            Play again
          </button>
        </div>
      ) : null}
    </div>
  )
}
