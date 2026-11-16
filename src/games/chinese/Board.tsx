import { POINTS, type Pt } from './rules'

const px = (p: Pt) => Math.sqrt(3) * (p[0] + p[2] / 2)
const py = (p: Pt) => 1.5 * p[2]
const xs = POINTS.map(px)
const ys = POINTS.map(py)
const PAD = 1
const MINX = Math.min(...xs) - PAD
const MINY = Math.min(...ys) - PAD
export const W = Math.max(...xs) + PAD - MINX
export const H = Math.max(...ys) + PAD - MINY
/** Width over height of the board, for the layout. */
export const ASPECT = W / H
const HOLE = ((0.86 * Math.sqrt(3)) / W) * 100

export const COLOURS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'] as const
export const GLYPHS = ['●', '■', '▲', '◆', '★', '✚'] as const

const name = (i: number) => `x ${POINTS[i][0]}, y ${POINTS[i][1]}, z ${POINTS[i][2]}`

/**
 * The 121-hole star. Every hole is a real button, so Tab and Enter work as well as touch. Each man carries a shape
 * as well as a colour, so players can be told apart without seeing colour.
 */
export function StarBoard({ cells, selected, targets, last, disabled, onPoint }: {
  cells: readonly number[]
  selected: number | null
  targets: ReadonlySet<number>
  last: { from: number; to: number } | null
  disabled: boolean
  onPoint: (i: number) => void
}) {
  return (
    <div className="cc-board" role="group" aria-label="Star Hop board" style={{ aspectRatio: `${W} / ${H}` }}>
      {POINTS.map((_, i) => {
        const c = cells[i]
        const what = c === 0 ? 'empty' : `${COLOURS[c - 1]} man`
        return (
          <button
            key={i}
            className="cc-hole"
            data-pt={i}
            data-p={c || undefined}
            data-sel={selected === i ? 'true' : undefined}
            data-target={targets.has(i) ? 'true' : undefined}
            data-last={last && (last.to === i || last.from === i) ? 'true' : undefined}
            style={{ left: `${((xs[i] - MINX) / W) * 100}%`, top: `${((ys[i] - MINY) / H) * 100}%`, width: `${HOLE}%` }}
            disabled={disabled}
            onClick={() => onPoint(i)}
            aria-label={`${name(i)}, ${what}${targets.has(i) ? ', move here' : ''}`}
            aria-pressed={selected === i}
          >
            {c ? <span className="cc-man">{GLYPHS[c - 1]}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
