import { EDGES, type Move, type Piece } from './rules'

const COORDS: readonly (readonly [number, number])[] = [
  [50, 5],
  [8, 27], [39.5, 27], [46.5, 27], [53.5, 27], [60.5, 27], [92, 27],
  [8, 49], [29, 49], [43, 49], [57, 49], [71, 49], [92, 49],
  [8, 71], [18.5, 71], [39.5, 71], [60.5, 71], [81.5, 71], [92, 71],
  [8, 94], [36, 94], [64, 94], [92, 94],
]

type Props = { cells: Piece[]; selected: number | null; moves: Move[]; disabled: boolean; onPoint: (point: number) => void }

export function AaduPuliBoard({ cells, selected, moves, disabled, onPoint }: Props) {
  const targets = new Set(moves.map((m) => m.to))
  const movable = new Set(moves.map((m) => m.from).filter((p): p is number => p !== null))
  return (
    <div className="ap-board" role="group" aria-label="Aadu Puli Attam board with 23 points">
      <svg className="ap-lines" viewBox="0 0 100 100" aria-hidden="true">
        {EDGES.map(([a, b]) => <line key={`${a}-${b}`} x1={COORDS[a][0]} y1={COORDS[a][1]} x2={COORDS[b][0]} y2={COORDS[b][1]} />)}
      </svg>
      {COORDS.map(([x, y], point) => {
        const piece = cells[point]
        const label = piece === 'T' ? `Tiger at point ${point + 1}` : piece === 'G' ? `Goat at point ${point + 1}` : `Empty point ${point + 1}`
        return <button key={point} type="button" className="ap-point" style={{ left: `${x}%`, top: `${y}%` }} data-point={point}
          data-piece={piece ?? undefined} data-selected={selected === point || undefined} data-target={targets.has(point) || undefined}
          data-movable={movable.has(point) || undefined} aria-label={label} aria-pressed={selected === point} disabled={disabled} onClick={() => onPoint(point)}>
          {piece === 'T' ? <span aria-hidden="true">🐯</span> : piece === 'G' ? <span aria-hidden="true">●</span> : null}
        </button>
      })}
    </div>
  )
}
