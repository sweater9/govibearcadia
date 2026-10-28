import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { RotateCcw, Shuffle } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { SIZES, cellsOf, isRight, newGame, normalise, place, remove, reset, scoreFor, type CarveState, type Size } from './carve/rules'

export function Carve({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [size, setSize] = useState<Size>(5)
  const [game, setGameState] = useState<CarveState>(() => newGame(5, random))
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null)
  const [seconds, setSeconds] = useState(0)
  const current = useRef(game)
  const dragRef = useRef<{ from: number; to: number } | null>(null)
  const startedAt = useRef(0)
  const finish = useRef(onFinish)
  finish.current = onFinish

  const setGame = useCallback((next: CarveState) => {
    const before = current.current
    if (next === before) return
    if (startedAt.current === 0) startedAt.current = Date.now()
    current.current = next
    setGameState(next)
    if (next.status === 'won' && before.status !== 'won') {
      const elapsed = Date.now() - startedAt.current
      setSeconds(Math.floor(elapsed / 1000))
      finish.current({ score: scoreFor(elapsed / 1000), durationMs: elapsed, won: true, stats: { size: next.puzzle.size, pieces: next.rects.length } })
    }
  }, [])

  const started = startedAt.current !== 0
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

  const cellAt = (e: PointerEvent): number | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-cell]')
    return el ? Number(el.dataset.cell) : null
  }
  const setDragBoth = (d: { from: number; to: number } | null) => {
    dragRef.current = d
    setDrag(d)
  }
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    const c = cellAt(e)
    if (c === null) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDragBoth({ from: c, to: c })
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    const c = cellAt(e)
    if (d && c !== null && c !== d.to) setDragBoth({ from: d.from, to: c })
  }
  const onUp = () => {
    const d = dragRef.current
    setDragBoth(null)
    if (!d) return
    const s = current.current
    const owned = s.rects.some((r) => cellsOf(r, s.puzzle.size).includes(d.from))
    if (d.from === d.to && owned) setGame(remove(s, d.from))
    else setGame(place(s, normalise(d.from, d.to, s.puzzle.size)))
  }

  const { puzzle, rects } = game
  const n = puzzle.size
  const owner = new Map<number, number>()
  rects.forEach((r, i) => cellsOf(r, n).forEach((c) => owner.set(c, i)))
  const preview = drag ? new Set(cellsOf(normalise(drag.from, drag.to, n), n)) : new Set<number>()
  const wrong = new Set(rects.flatMap((r) => (isRight(puzzle, r) ? [] : cellsOf(r, n))))

  return (
    <div className="cv">
      <div className="game-toolbar cv-bar">
        <div>
          <small>Time</small>
          <strong>{seconds}</strong>
        </div>
        <div>
          <small>Pieces</small>
          <strong aria-label="Pieces">{rects.length}</strong>
        </div>
        <select aria-label="Size" value={size} onChange={(e) => deal(Number(e.target.value) as Size)}>
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s}×{s}
            </option>
          ))}
        </select>
        <button aria-label="Reset" onClick={() => setGame(reset(current.current))}>
          <RotateCcw size={15} />
        </button>
        <button aria-label="New puzzle" onClick={() => deal(size)}>
          <Shuffle size={15} />
        </button>
      </div>
      <div
        className="cv-board"
        role="group"
        aria-label={`Carve ${n} by ${n}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setDragBoth(null)}
        style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
      >
        {Array.from({ length: n * n }, (_, c) => {
          const o = owner.get(c)
          const hue = o === undefined ? 0 : (o * 47) % 360
          return (
            <div
              key={c}
              data-cell={c}
              data-piece={o === undefined ? undefined : o}
              className={`cv-cell ${o !== undefined ? 'in' : ''} ${wrong.has(c) ? 'bad' : ''} ${preview.has(c) ? 'pre' : ''}`}
              style={o !== undefined && !wrong.has(c) ? { background: `hsl(${hue} 70% 55% / .35)` } : undefined}
              aria-label={`Row ${Math.floor(c / n) + 1}, column ${(c % n) + 1}${puzzle.numbers[c] ? `, number ${puzzle.numbers[c]}` : ''}${o !== undefined ? ', in a piece' : ''}`}
            >
              {puzzle.numbers[c] ?? ''}
            </div>
          )
        })}
      </div>
      <p className="cv-hint">Drag to carve a rectangle around each number so its area equals the number. Tap a piece to remove it.</p>
      {game.status === 'won' ? (
        <div className="win-message" role="status">
          Carved in {seconds}s! Score {scoreFor(seconds)}
          <button className="gf-next" onClick={() => deal(size)}>
            New puzzle
          </button>
        </div>
      ) : null}
    </div>
  )
}
