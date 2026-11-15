import { type Size } from './rules'

const STARS: Record<Size, [number, number][]> = {
  9: [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]],
  13: [[3, 3], [9, 3], [6, 6], [3, 9], [9, 9], [3, 6], [9, 6], [6, 3], [6, 9]],
}
const col = (x: number) => 'ABCDEFGHJKLMN'[x]

/**
 * The board. Every point is a real button, so Tab and Enter work as well as touch. Stones sit on the line crossings.
 */
export function GoBoard({ size, cells, last, disabled, onPoint }: { size: Size; cells: readonly number[]; last: number | null; disabled: boolean; onPoint: (p: number) => void }) {
  const pc = (v: number) => `${((v + 0.5) / size) * 100}%`
  return (
    <div className="go-board" role="group" aria-label={`Go board, ${size} by ${size}`}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true" preserveAspectRatio="none">
        {Array.from({ length: size }, (_, i) => (
          <g key={i}>
            <line x1={0.5} y1={i + 0.5} x2={size - 0.5} y2={i + 0.5} />
            <line x1={i + 0.5} y1={0.5} x2={i + 0.5} y2={size - 0.5} />
          </g>
        ))}
        {STARS[size].map(([x, y]) => <circle key={`${x},${y}`} cx={x + 0.5} cy={y + 0.5} r={0.09} className="go-star" />)}
      </svg>
      {cells.map((c, p) => {
        const x = p % size
        const y = Math.floor(p / size)
        const what = c === 0 ? 'empty' : c === 1 ? 'black stone' : 'white stone'
        return (
          <button
            key={p}
            className="go-pt"
            data-pt={p}
            data-p={c || undefined}
            data-last={last === p ? 'true' : undefined}
            style={{ left: pc(x), top: pc(y), width: `${100 / size}%` }}
            disabled={disabled || c !== 0}
            onClick={() => onPoint(p)}
            aria-label={`${col(x)}${size - y}, ${what}`}
          >
            {c ? <span className="go-stone" /> : null}
          </button>
        )
      })}
    </div>
  )
}
