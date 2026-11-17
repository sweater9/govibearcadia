import { useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps, GameResult } from '../types'
import { SIZES, blank, colDone, filledCount, isSolved, newPuzzle, rowDone, setCell, type Cell, type Grid } from './nonogram/rules'
import './nonogram/nonogram.css'

const WORD = ['blank', 'filled', 'marked empty'] as const

export function Nonogram({ onFinish, seed }: GameProps) {
  const [base] = useState(() => seed ?? String(createRandom()()))
  const [size, setSize] = useState<number>(5)
  const [deal, setDeal] = useState(0)
  const [grid, setGridState] = useState<Grid>(() => blank(5))
  const [tool, setTool] = useState<1 | 2>(1)
  const [result, setResult] = useState<GameResult | null>(null)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const gridRef = useRef(grid)
  const painting = useRef<Cell | null>(null)
  const reported = useRef(false)

  const puzzle = newPuzzleFor(base, deal, size)
  const solved = result !== null

  function start(nextSize: number, nextDeal: number) {
    const fresh = blank(nextSize)
    gridRef.current = fresh
    setGridState(fresh)
    setSize(nextSize)
    setDeal(nextDeal)
    setResult(null)
    setStartedAt(Date.now())
    reported.current = false
    painting.current = null
  }

  function paint(r: number, c: number, value: Cell) {
    if (solved) return
    const next = setCell(gridRef.current, r, c, value)
    if (next === gridRef.current) return
    gridRef.current = next
    setGridState(next)
    if (!reported.current && isSolved(puzzle, next)) {
      reported.current = true
      const durationMs = Math.max(0, Date.now() - startedAt)
      const cells = puzzle.size * puzzle.size
      const finished: GameResult = { score: cells * 10 + Math.max(0, cells * 10 - Math.floor(durationMs / 1000)), durationMs, won: true, stats: { size: puzzle.size, filled: filledCount(next) } }
      setResult(finished)
      onFinish(finished)
    }
  }
  const valueFor = (r: number, c: number, use: 1 | 2): Cell => (gridRef.current[r][c] === use ? 0 : use)

  const rowClueWidth = Math.ceil(size / 2)
  const style = { '--n': size, '--rw': rowClueWidth } as React.CSSProperties

  return (
    <div className="ng" style={style}>
      <div className="ng-bar">
        <div className="ng-seg" role="group" aria-label="Puzzle size">
          {SIZES.map((s) => <button key={s} type="button" aria-pressed={size === s} onClick={() => s !== size && start(s, deal + 1)}>{s}×{s}</button>)}
        </div>
        <div className="ng-seg" role="group" aria-label="Tool">
          <button type="button" aria-pressed={tool === 1} onClick={() => setTool(1)}>Fill</button>
          <button type="button" aria-pressed={tool === 2} onClick={() => setTool(2)}>Mark empty</button>
        </div>
        <button type="button" className="secondary-btn ng-btn" onClick={() => start(size, deal)}>Clear</button>
        <button type="button" className="secondary-btn ng-btn" onClick={() => start(size, deal + 1)}>New puzzle</button>
      </div>

      <div className="ng-board" onContextMenu={(e) => e.preventDefault()} onPointerUp={() => { painting.current = null }} onPointerLeave={() => { painting.current = null }}>
        <span className="ng-corner" />
        <div className="ng-cols">
          {puzzle.cols.map((clue, c) => (
            <div key={c} className="ng-clue ng-colclue" data-done={colDone(puzzle, grid, c) ? 'true' : undefined} aria-label={`Column ${c + 1} clue ${clue.join(' ')}`}>{clue.map((n, i) => <b key={i}>{n}</b>)}</div>
          ))}
        </div>
        <div className="ng-rows">
          {puzzle.rows.map((clue, r) => (
            <div key={r} className="ng-clue ng-rowclue" data-done={rowDone(puzzle, grid, r) ? 'true' : undefined} aria-label={`Row ${r + 1} clue ${clue.join(' ')}`}>{clue.map((n, i) => <b key={i}>{n}</b>)}</div>
          ))}
        </div>
        <div className="ng-grid" role="group" aria-label="Picture grid">
          {grid.map((row, r) => row.map((v, c) => (
            <button
              key={`${r}-${c}`}
              type="button"
              className="ng-cell"
              data-v={v}
              data-edge-r={(c + 1) % 5 === 0 && c + 1 < size ? 'true' : undefined}
              data-edge-b={(r + 1) % 5 === 0 && r + 1 < size ? 'true' : undefined}
              aria-label={`Row ${r + 1}, column ${c + 1}: ${WORD[v]}`}
              onPointerDown={(e) => {
                if (e.button === 2) { const value = valueFor(r, c, 2); painting.current = value; paint(r, c, value); return }
                const value = valueFor(r, c, tool)
                painting.current = value
                paint(r, c, value)
              }}
              onPointerEnter={(e) => { if (painting.current !== null && e.buttons) paint(r, c, painting.current) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); paint(r, c, valueFor(r, c, tool)) } }}
            />
          )))}
        </div>
        {solved && result && (
          <div className="ng-over" role="status">
            <strong>Picture complete!</strong>
            <span>Score {result.score}</span>
            <button type="button" className="primary-btn" onClick={() => start(size, deal + 1)}>New puzzle</button>
          </div>
        )}
      </div>
      <p className="ng-help">Numbers give the runs of filled squares in each row and column. Tap or drag to fill.</p>
    </div>
  )
}

function newPuzzleFor(base: string, deal: number, size: number) {
  return newPuzzle(deal === 0 ? `${base}:${size}` : `${base}-${deal}:${size}`, size)
}
