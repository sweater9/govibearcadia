import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Flag, RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { BEGINNER, chord, minesLeft, newGame, reveal, scoreFor, toggleFlag, type Cell, type MinesState } from './minesweeper/rules'

const MOVES: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

function describe(cell: Cell): string {
  if (cell.state === 'hidden') return 'hidden'
  if (cell.state === 'flagged') return 'flagged'
  if (cell.mine) return 'mine'
  return cell.adjacent === 0 ? 'empty' : `${cell.adjacent} adjacent ${cell.adjacent === 1 ? 'mine' : 'mines'}`
}

const glyph = (cell: Cell): string => {
  if (cell.state === 'flagged') return '⚑'
  if (cell.state === 'hidden') return ''
  if (cell.mine) return '✹'
  return cell.adjacent ? String(cell.adjacent) : ''
}

export function Minesweeper({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [game, setGame] = useState<MinesState>(() => newGame(BEGINNER))
  const [flagMode, setFlagMode] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [cursor, setCursor] = useState<[number, number]>([0, 0])
  const startedAt = useRef(0)
  const cells = useRef(new Map<string, HTMLButtonElement>())
  const { rows, cols } = game.config

  // Clock display only; it never touches game state.
  useEffect(() => {
    if (game.status !== 'playing') return
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [game.status])

  // All transitions go through here, from event handlers. A run is reported once, when it ends.
  const apply = useCallback(
    (next: MinesState) => {
      if (next === game) return
      if (game.status === 'ready') startedAt.current = Date.now()
      setGame(next)
      if (next.status === 'won' || next.status === 'lost') {
        const elapsed = Date.now() - startedAt.current
        setSeconds(Math.floor(elapsed / 1000))
        onFinish({
          score: scoreFor(next, elapsed / 1000),
          durationMs: elapsed,
          won: next.status === 'won',
          stats: { opened: next.opened, flags: next.flags, mines: next.config.mines },
        })
      }
    },
    [game, onFinish],
  )

  const press = (r: number, c: number) => {
    const cell = game.cells[r][c]
    if (flagMode) apply(toggleFlag(game, r, c))
    else if (cell.state === 'open') apply(chord(game, r, c, random))
    else apply(reveal(game, r, c, random))
  }

  const secondary = (event: MouseEvent, r: number, c: number) => {
    event.preventDefault()
    apply(toggleFlag(game, r, c))
  }

  const onKeyDown = (event: KeyboardEvent, r: number, c: number) => {
    const move = MOVES[event.key]
    if (move) {
      event.preventDefault()
      const nr = Math.min(rows - 1, Math.max(0, r + move[0]))
      const nc = Math.min(cols - 1, Math.max(0, c + move[1]))
      setCursor([nr, nc])
      cells.current.get(`${nr},${nc}`)?.focus()
    } else if (event.key === 'f' || event.key === 'F') {
      event.preventDefault()
      apply(toggleFlag(game, r, c))
    }
  }

  const restart = () => {
    startedAt.current = 0
    setSeconds(0)
    setFlagMode(false)
    setGame(newGame(BEGINNER))
  }

  const over = game.status === 'won' || game.status === 'lost'

  return (
    <div className="mines">
      <div className="game-toolbar mines-bar">
        <div>
          <small>Mines</small>
          <strong>{minesLeft(game)}</strong>
        </div>
        <div>
          <small>Time</small>
          <strong>{seconds}</strong>
        </div>
        <button aria-label="Flag mode" aria-pressed={flagMode} className={flagMode ? 'on' : ''} onClick={() => setFlagMode((on) => !on)}>
          <Flag size={15} />
          Flag
        </button>
        <button onClick={restart}>
          <RotateCcw size={15} />
          New
        </button>
      </div>
      <div className="mines-grid" role="group" aria-label="Minesweeper board" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {game.cells.flatMap((row, r) =>
          row.map((cell, c) => {
            const exploded = game.exploded?.[0] === r && game.exploded?.[1] === c
            return (
              <button
                key={`${r}-${c}`}
                ref={(el) => {
                  if (el) cells.current.set(`${r},${c}`, el)
                  else cells.current.delete(`${r},${c}`)
                }}
                data-r={r}
                data-c={c}
                className={`mine-cell ${cell.state} ${cell.state === 'open' && !cell.mine ? `n${cell.adjacent}` : ''} ${exploded ? 'boom' : ''}`}
                aria-label={`Row ${r + 1}, column ${c + 1}: ${describe(cell)}`}
                tabIndex={cursor[0] === r && cursor[1] === c ? 0 : -1}
                onFocus={() => setCursor([r, c])}
                onClick={() => press(r, c)}
                onContextMenu={(event) => secondary(event, r, c)}
                onKeyDown={(event) => onKeyDown(event, r, c)}
              >
                {glyph(cell)}
              </button>
            )
          }),
        )}
      </div>
      <p className="mines-hint">Click to open · right-click, F or Flag mode to flag · click a number to open around it</p>
      {over ? (
        <div className="win-message" role="status">
          {game.status === 'won' ? 'Field cleared!' : 'Boom! You hit a mine.'} Score {scoreFor(game, seconds)}
        </div>
      ) : null}
    </div>
  )
}
