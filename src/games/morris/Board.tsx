import { NEIGHBOURS, POINTS, type Cell } from './rules'

/** Position of each point on a 7x7 grid, in the same order as the rules. */
const XY: readonly (readonly [number, number])[] = Array.from({ length: POINTS }, (_, p) => {
  const r = Math.floor(p / 8)
  const i = p % 8
  const lo = r
  const hi = 6 - r
  const x = [lo, 3, hi, hi, hi, 3, lo, lo][i]
  const y = [lo, lo, lo, 3, hi, hi, hi, 3][i]
  return [x, y] as const
})

const label = (p: number) => `ring ${Math.floor(p / 8) + 1}, point ${(p % 8) + 1}`
const SCALE = 100 / 6

/**
 * The 24-point board, shared by the single-player game and online rooms. Every point is a real button, so Tab and
 * Enter work as well as touch. `removable` marks the men that may be taken after a mill.
 */
export function MorrisBoard({ cells, selected, targets, removable, mills, disabled, names = ['red', 'blue'], onPoint }: {
  cells: readonly Cell[]
  selected: number | null
  targets: ReadonlySet<number>
  removable: ReadonlySet<number>
  mills?: ReadonlySet<number>
  disabled: boolean
  names?: readonly [string, string]
  onPoint: (p: number) => void
}) {
  const lines = new Set<string>()
  NEIGHBOURS.forEach((n, a) => n.forEach((b) => a < b && lines.add(`${a}-${b}`)))
  return (
    <div className="nm-board" role="group" aria-label="Nine Men's Morris board">
      <svg viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
        {[...lines].map((k) => {
          const [a, b] = k.split('-').map(Number)
          return <line key={k} x1={XY[a][0] * SCALE} y1={XY[a][1] * SCALE} x2={XY[b][0] * SCALE} y2={XY[b][1] * SCALE} />
        })}
      </svg>
      {Array.from({ length: POINTS }, (_, p) => {
        const c = cells[p]
        const what = c === 0 ? 'empty' : `${names[c - 1]} man`
        const note = targets.has(p) ? ', move here' : removable.has(p) ? ', remove' : ''
        return (
          <button
            key={p}
            className="nm-pt"
            data-pt={p}
            data-p={c || undefined}
            data-sel={selected === p ? 'true' : undefined}
            data-target={targets.has(p) ? 'true' : undefined}
            data-remove={removable.has(p) ? 'true' : undefined}
            data-mill={mills?.has(p) ? 'true' : undefined}
            style={{ left: `${XY[p][0] * SCALE}%`, top: `${XY[p][1] * SCALE}%` }}
            disabled={disabled}
            onClick={() => onPoint(p)}
            aria-label={`${label(p)}, ${what}${note}`}
            aria-pressed={selected === p}
          >
            {c ? <span className="nm-man" /> : null}
          </button>
        )
      })}
    </div>
  )
}

