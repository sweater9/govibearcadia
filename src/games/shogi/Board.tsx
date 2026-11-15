import { pieceName, squareName } from './names'
import { DROPPABLE, NAMES, kindOf, ownerOf, type Owner } from './rules'
import type { Labels } from './names'

const KANJI: Record<number, string> = { 1: '歩', 2: '香', 3: '桂', 4: '銀', 5: '金', 6: '角', 7: '飛', 8: '玉', 9: 'と', 10: '成香', 11: '成桂', 12: '成銀', 14: '馬', 15: '龍' }
const ENGLISH: Record<number, string> = { 1: 'P', 2: 'L', 3: 'N', 4: 'S', 5: 'G', 6: 'B', 7: 'R', 8: 'K', 9: '+P', 10: '+L', 11: '+N', 12: '+S', 14: '+B', 15: '+R' }

/** One piece, drawn as a wooden shogi tile pointing at the opponent. Kanji, plain letters, or both. */
export function Koma({ kind, owner, labels }: { kind: number; owner: Owner; labels: Labels }) {
  const k = owner === 2 && kind === 8 ? '王' : KANJI[kind]
  return (
    <span className="sg-pc" data-owner={owner}>
      <span className="sg-koma" data-k={kind} data-promoted={kind > 8 ? 'true' : undefined} data-labels={labels}>
        {labels !== 'english' ? <b className="sg-kanji">{k}</b> : null}
        {labels !== 'kanji' ? <i className="sg-eng">{ENGLISH[kind]}</i> : null}
      </span>
    </span>
  )
}

/** The 9x9 board. Every square is a button, so Tab and Enter work as well as touch. */
export function ShogiBoard({ cells, selected, targets, last, checkSquare, disabled, labels, onSquare }: {
  cells: readonly number[]
  selected: number | null
  targets: ReadonlySet<number>
  last: { from: number; to: number } | null
  checkSquare: number
  disabled: boolean
  labels: Labels
  onSquare: (i: number) => void
}) {
  return (
    <div className="sg-board" role="group" aria-label="Shogi board">
      {cells.map((c, i) => {
        const o = ownerOf(c)
        const what = c === 0 ? 'empty' : `${o === 1 ? 'black' : 'white'} ${pieceName(kindOf(c))}`
        return (
          <button
            key={i}
            className="sg-sq"
            data-sq={i}
            data-p={o || undefined}
            data-k={c ? kindOf(c) : undefined}
            data-sel={selected === i ? 'true' : undefined}
            data-target={targets.has(i) ? 'true' : undefined}
            data-last={last && (last.from === i || last.to === i) ? 'true' : undefined}
            data-check={checkSquare === i ? 'true' : undefined}
            disabled={disabled}
            onClick={() => onSquare(i)}
            aria-label={`${squareName(i)}, ${what}${targets.has(i) ? ', move here' : ''}`}
            aria-pressed={selected === i}
          >
            {c ? <Koma kind={kindOf(c)} owner={o as Owner} labels={labels} /> : null}
          </button>
        )
      })}
    </div>
  )
}

/** The pieces a player holds in hand. Tap one to drop it. */
export function Hand({ owner, hand, selected, enabled, labels, onPick }: {
  owner: Owner
  hand: readonly number[]
  selected: number
  enabled: boolean
  labels: Labels
  onPick: (kind: number) => void
}) {
  const held = DROPPABLE.filter((k) => hand[k - 1] > 0)
  return (
    <div className="sg-hand" data-owner={owner} role="group" aria-label={`${owner === 1 ? 'Black' : 'White'} pieces in hand`}>
      {held.length === 0 ? <span className="sg-none">No pieces in hand</span> : null}
      {held.map((k) => (
        <button key={k} className="sg-held" data-hand={k} data-sel={selected === k ? 'true' : undefined} disabled={!enabled} aria-pressed={selected === k} aria-label={`${NAMES[k]} in hand, ${hand[k - 1]}`} onClick={() => onPick(k)}>
          <Koma kind={k} owner={owner} labels={labels} />
          {hand[k - 1] > 1 ? <small>×{hand[k - 1]}</small> : null}
        </button>
      ))}
    </div>
  )
}
