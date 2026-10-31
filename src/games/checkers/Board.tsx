import { SIZE, isDark, isKing, ownerOf, type Cell } from './rules'

const name = (i: number) => `row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}`

/**
 * The 8x8 board, shared by the single-player game and online rooms. Only dark squares can be played, and they are
 * real buttons, so Tab and Enter work as well as touch. `flip` turns the board around for the second player.
 */
export function CheckersBoard({ cells, selected, targets, flip, disabled, onSquare }: { cells: readonly Cell[]; selected: number | null; targets: ReadonlySet<number>; flip: boolean; disabled: boolean; onSquare: (i: number) => void }) {
  const order = Array.from({ length: SIZE * SIZE }, (_, k) => (flip ? SIZE * SIZE - 1 - k : k))
  return (
    <div className="ck-board" role="group" aria-label="Checkers board">
      {order.map((i) => {
        const c = cells[i]
        const piece = c === 0 ? null : <span className="ck-piece" data-p={ownerOf(c)} data-king={isKing(c) ? 'true' : undefined} />
        if (!isDark(i)) return <div key={i} className="ck-sq" />
        const what = c === 0 ? 'empty' : `${ownerOf(c) === 1 ? 'red' : 'white'} ${isKing(c) ? 'king' : 'piece'}`
        return (
          <button
            key={i}
            className="ck-sq"
            data-dark="true"
            data-sq={i}
            data-sel={selected === i ? 'true' : undefined}
            data-target={targets.has(i) ? 'true' : undefined}
            disabled={disabled}
            onClick={() => onSquare(i)}
            aria-label={`${name(i)}, ${what}${targets.has(i) ? ', move here' : ''}`}
            aria-pressed={selected === i}
          >
            {piece}
          </button>
        )
      })}
    </div>
  )
}
