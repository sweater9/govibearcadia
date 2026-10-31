import type { Cell } from './rules'

const MARK = ['', 'X', 'O']

/** The 3x3 board, shared by the single-player game and online rooms. */
export function TicTacToeBoard({ cells, line, disabled, onCell }: { cells: readonly Cell[]; line: readonly number[] | null; disabled: boolean; onCell: (i: number) => void }) {
  return (
    <div className="ttt-board" role="group" aria-label="Tic-Tac-Toe board">
      {cells.map((c, i) => (
        <button
          key={i}
          className="ttt-cell"
          data-cell={i}
          data-p={c}
          data-win={line?.includes(i) ? 'true' : undefined}
          disabled={disabled || c !== 0}
          onClick={() => onCell(i)}
          aria-label={`Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}, ${c === 0 ? 'empty' : MARK[c]}`}
        >
          {MARK[c]}
        </button>
      ))}
    </div>
  )
}
