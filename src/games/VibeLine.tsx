import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { RotateCcw, Shuffle, Undo2 } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { SIZES, newGame, reached, reset, scoreFor, step, undo, type Size, type VibeState } from './vibeline/rules'

export function VibeLine({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [size, setSize] = useState<Size>(5)
  const [game, setGameState] = useState<VibeState>(() => newGame(5, random))
  const [seconds, setSeconds] = useState(0)
  const current = useRef(game)
  const startedAt = useRef(0)
  const dragging = useRef(false)
  const finish = useRef(onFinish)
  finish.current = onFinish

  const setGame = useCallback((next: VibeState) => {
    const before = current.current
    if (next === before) return
    if (startedAt.current === 0 && next.path.length > 1) startedAt.current = Date.now()
    current.current = next
    setGameState(next)
    if (next.status === 'won' && before.status !== 'won') {
      const elapsed = Date.now() - startedAt.current
      setSeconds(Math.floor(elapsed / 1000))
      finish.current({
        score: scoreFor(elapsed / 1000),
        durationMs: elapsed,
        won: true,
        stats: { size: next.puzzle.size, numbers: next.puzzle.count },
      })
    }
  }, [])

  // Clock display only.
  const started = game.path.length > 1
  useEffect(() => {
    if (game.status !== 'playing' || !started) return
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [game.status, started])

  const deal = (n: Size) => {
    startedAt.current = 0
    setSeconds(0)
    setSize(n)
    const g = newGame(n, random)
    current.current = g
    setGameState(g)
  }

  const cellAt = (event: PointerEvent): number | null => {
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-cell]')
    return el ? Number(el.dataset.cell) : null
  }
  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const c = cellAt(event)
    if (c !== null) setGame(step(current.current, c))
  }
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const c = cellAt(event)
    if (c !== null) setGame(step(current.current, c))
  }
  const onKeyDown = (event: KeyboardEvent) => {
    const s = current.current
    const head = s.path[s.path.length - 1]
    const n = s.puzzle.size
    const x = head % n
    const y = Math.floor(head / n)
    const to: Record<string, number | null> = {
      ArrowUp: y > 0 ? head - n : null,
      ArrowDown: y < n - 1 ? head + n : null,
      ArrowLeft: x > 0 ? head - 1 : null,
      ArrowRight: x < n - 1 ? head + 1 : null,
    }
    if (event.key in to) {
      event.preventDefault()
      const c = to[event.key]
      if (c !== null) setGame(step(s, c))
    } else if (event.key === 'z' || event.key === 'Backspace') {
      event.preventDefault()
      setGame(undo(s))
    }
  }

  const { puzzle, path } = game
  const n = puzzle.size
  const order = new Map(path.map((c, i) => [c, i]))
  const head = path[path.length - 1]
  const pt = (c: number) => `${(c % n) + 0.5},${Math.floor(c / n) + 0.5}`

  return (
    <div className="vl">
      <div className="game-toolbar vl-bar">
        <div>
          <small>Time</small>
          <strong>{seconds}</strong>
        </div>
        <div>
          <small>Next</small>
          <strong aria-label="Next number">{Math.min(puzzle.count, reached(game) + 1)}</strong>
        </div>
        <select aria-label="Size" value={size} onChange={(e) => deal(Number(e.target.value) as Size)}>
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s}×{s}
            </option>
          ))}
        </select>
        <button aria-label="Undo" onClick={() => setGame(undo(current.current))} disabled={path.length < 2 || game.status === 'won'}>
          <Undo2 size={15} />
        </button>
        <button aria-label="Reset" onClick={() => setGame(reset(current.current))}>
          <RotateCcw size={15} />
        </button>
        <button aria-label="New puzzle" onClick={() => deal(size)}>
          <Shuffle size={15} />
        </button>
      </div>
      <div
        className="vl-board"
        role="group"
        aria-label={`VibeLine ${n} by ${n}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, ['--gn' as string]: n }}
      >
        <svg className="vl-line" viewBox={`0 0 ${n} ${n}`} aria-hidden="true">
          <polyline points={path.map(pt).join(' ')} />
        </svg>
        {Array.from({ length: n * n }, (_, c) => (
          <div
            key={c}
            data-cell={c}
            data-on={order.has(c) ? '' : undefined}
            data-head={c === head ? '' : undefined}
            className={`vl-cell ${order.has(c) ? 'on' : ''} ${c === head ? 'head' : ''}`}
            aria-label={`Row ${Math.floor(c / n) + 1}, column ${(c % n) + 1}${puzzle.numbers[c] ? `, number ${puzzle.numbers[c]}` : ''}${order.has(c) ? ', on the line' : ''}`}
          >
            {puzzle.numbers[c] ? <span className="vl-num">{puzzle.numbers[c]}</span> : null}
          </div>
        ))}
      </div>
      <p className="vl-hint">Drag from 1 through the numbers in order to fill every square · arrows move the line · Z undoes</p>
      {game.status === 'won' ? (
        <div className="win-message" role="status">
          Line complete in {seconds}s! Score {scoreFor(seconds)}
          <button className="gf-next" onClick={() => deal(size)}>
            New puzzle
          </button>
        </div>
      ) : null}
    </div>
  )
}
