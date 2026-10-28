import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, RotateCcw, Undo2, ArrowUpDown } from 'lucide-react'
import type { GameProps } from '../types'
import { LEVELS, flip, move, newGame, par, parseLevel, restart, scoreFor, starsFor, undo, type GravityState } from './gravity/rules'

const START_LEVEL = 0

export function GravityFlip({ onFinish }: GameProps) {
  const [game, setGameState] = useState<GravityState>(() => newGame(START_LEVEL))
  const current = useRef(game)
  const startedAt = useRef(Date.now())
  const finish = useRef(onFinish)
  finish.current = onFinish

  const pars = useMemo(() => LEVELS.map((_, i) => par(i) ?? 0), [])

  // Every transition goes through here, from event handlers. The win is reported once, when it happens.
  const setGame = useCallback((next: GravityState) => {
    const before = current.current
    if (next === before) return
    current.current = next
    setGameState(next)
    if (next.status === 'won' && before.status !== 'won') {
      const p = pars[next.level]
      finish.current({
        score: scoreFor(next.moves, p),
        durationMs: Date.now() - startedAt.current,
        won: true,
        stats: { level: next.level + 1, moves: next.moves, par: p, stars: starsFor(next.moves, p) },
      })
    }
  }, [pars])

  const go = useCallback(
    (level: number) => {
      if (level < 0 || level >= LEVELS.length) return
      startedAt.current = Date.now()
      current.current = newGame(level)
      setGameState(current.current)
    },
    [],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const s = current.current
      const k = event.key.toLowerCase()
      if (k === 'arrowleft' || k === 'a') setGame(move(s, -1))
      else if (k === 'arrowright' || k === 'd') setGame(move(s, 1))
      else if (k === 'arrowup' || k === 'arrowdown' || k === 'w' || k === 's' || k === ' ') setGame(flip(s))
      else if (k === 'z' || k === 'u') setGame(undo(s))
      else if (k === 'r') setGame(restart(s))
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setGame])

  const level = LEVELS[game.level]
  const { cells, w, h } = useMemo(() => parseLevel(level), [level])
  const p = pars[game.level]
  const won = game.status === 'won'
  const dead = game.status === 'dead'

  return (
    <div className="gf">
      <div className="game-toolbar gf-bar">
        <button aria-label="Previous level" onClick={() => go(game.level - 1)} disabled={game.level === 0}>
          <ChevronLeft size={15} />
        </button>
        <div>
          <small>Level</small>
          <strong>
            {game.level + 1}/{LEVELS.length}
          </strong>
        </div>
        <div>
          <small>Moves</small>
          <strong aria-label="Moves">{game.moves}</strong>
        </div>
        <div>
          <small>Par</small>
          <strong>{p}</strong>
        </div>
        <button aria-label="Undo" onClick={() => setGame(undo(current.current))} disabled={!game.history.length || won}>
          <Undo2 size={15} />
        </button>
        <button aria-label="Restart level" onClick={() => setGame(restart(current.current))}>
          <RotateCcw size={15} />
        </button>
        <button aria-label="Next level" onClick={() => go(game.level + 1)} disabled={game.level === LEVELS.length - 1}>
          <ChevronRight size={15} />
        </button>
      </div>
      <p className="gf-name">{level.name}</p>
      <div
        className="gf-board"
        role="img"
        aria-label={`Level ${game.level + 1}, ${level.name}. Player at column ${game.x + 1}, row ${game.y + 1}, gravity ${game.g === 1 ? 'down' : 'up'}.`}
        style={{ gridTemplateColumns: `repeat(${w}, 1fr)`, ['--gw' as string]: w, ['--gh' as string]: h }}
      >
        {cells.flatMap((row, y) =>
          row.map((cell, x) => {
            const here = game.x === x && game.y === y
            const kind = cell === '#' ? 'wall' : cell === '^' ? 'spike' : cell === 'E' ? 'exit' : 'air'
            return (
              <div key={`${x}-${y}`} className={`gf-cell ${kind}`}>
                {cell === '^' ? (cells[y + 1]?.[x] === '#' ? '▲' : '▼') : cell === 'E' ? '◎' : ''}
                {here ? (
                  <span className={`gf-player ${dead ? 'dead' : ''} ${game.g === -1 ? 'up' : ''}`} data-testid="gf-player" data-x={x} data-y={y} data-g={game.g} />
                ) : null}
              </div>
            )
          }),
        )}
      </div>
      <div className="gf-pad">
        <button aria-label="Move left" onClick={() => setGame(move(current.current, -1))}>
          <ArrowLeft size={18} />
        </button>
        <button aria-label="Flip gravity" className="gf-flip" onClick={() => setGame(flip(current.current))}>
          <ArrowUpDown size={18} />
          Flip
        </button>
        <button aria-label="Move right" onClick={() => setGame(move(current.current, 1))}>
          <ArrowRight size={18} />
        </button>
      </div>
      <p className="gf-hint">← → move · ↑ ↓ or Space flips gravity · Z undo · R restart</p>
      {won ? (
        <div className="win-message" role="status">
          Level cleared in {game.moves} {game.moves === 1 ? 'move' : 'moves'}! {'★'.repeat(starsFor(game.moves, p))}
          {'☆'.repeat(3 - starsFor(game.moves, p))} Score {scoreFor(game.moves, p)}
          {game.level < LEVELS.length - 1 ? (
            <button className="gf-next" aria-label="Continue to next level" onClick={() => go(game.level + 1)}>
              Next level
            </button>
          ) : (
            <span> That was the last one.</span>
          )}
        </div>
      ) : null}
      {dead ? (
        <div className="win-message gf-dead" role="status">
          Spiked! Undo or restart.
        </div>
      ) : null}
    </div>
  )
}
