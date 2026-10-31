import { useEffect, useState } from 'react'
import { SIZE, type View } from './rules'

type Props = {
  view: View
  /** True when it is this player's shot and the opponent is there. */
  canFire: boolean
  /** True while this player may still shuffle and press Ready. */
  canPlace: boolean
  onFire: (cell: number) => void
  onShuffle: () => void
  onReady: () => void
}

const label = (i: number) => `row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}`

/**
 * One 10x10 grid at a time (so it fits a phone without scrolling), with tabs to switch between the enemy waters and
 * your own fleet. Shared by the single-player game and online rooms. It only ever draws what `view` contains.
 */
export function BattleshipBoard({ view, canFire, canPlace, onFire, onShuffle, onReady }: Props) {
  const b = view.board
  const [tab, setTab] = useState<'targets' | 'fleet'>(b.phase === 'battle' ? 'targets' : 'fleet')
  // Placing happens on your own fleet; the battle starts on the enemy waters; the end shows the enemy fleet.
  useEffect(() => setTab(b.phase === 'placing' ? 'fleet' : 'targets'), [b.phase])

  const mine = new Set(b.fleet.flat())
  const incoming = new Set(b.incoming)
  const shot = new Map(b.shots.map((s) => [s.cell, s.result]))
  const sunk = new Set(b.sunk.flat())
  const revealed = new Set(b.reveal?.flat() ?? [])

  return (
    <>
      <div className="bs-tabs" role="group" aria-label="Which board">
        <button type="button" aria-pressed={tab === 'targets'} onClick={() => setTab('targets')}>
          Enemy waters
        </button>
        <button type="button" aria-pressed={tab === 'fleet'} onClick={() => setTab('fleet')}>
          Your fleet
        </button>
      </div>
      <div className="bs-board" data-view={tab} role="group" aria-label={tab === 'targets' ? 'Enemy waters' : 'Your fleet'}>
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          if (tab === 'fleet') {
            const ship = mine.has(i)
            const hit = incoming.has(i)
            return <div key={i} className="bs-cell" data-ship={ship ? 'true' : undefined} data-state={hit ? (ship ? 'hit' : 'miss') : undefined} aria-label={`${label(i)}, ${ship ? 'ship' : 'water'}${hit ? (ship ? ', hit' : ', missed') : ''}`} />
          }
          const result = shot.get(i)
          if (result) return <div key={i} className="bs-cell" data-state={sunk.has(i) ? 'sunk' : result === 'miss' ? 'miss' : 'hit'} aria-label={`${label(i)}, ${sunk.has(i) ? 'sunk' : result === 'miss' ? 'miss' : 'hit'}`} />
          if (revealed.has(i)) return <div key={i} className="bs-cell" data-ship="true" data-reveal="true" aria-label={`${label(i)}, enemy ship`} />
          return <button key={i} type="button" className="bs-cell" data-cell={i} disabled={!canFire} onClick={() => onFire(i)} aria-label={`Fire at ${label(i)}`} />
        })}
      </div>
      {b.phase === 'placing' ? (
        <div className="bs-actions">
          <button type="button" className="secondary-btn" onClick={onShuffle} disabled={!canPlace}>
            Shuffle fleet
          </button>
          <button type="button" className="primary-btn" onClick={onReady} disabled={!canPlace}>
            Ready
          </button>
        </div>
      ) : null}
      <p className="bs-legend" aria-label="Ships left">
        Your ships: {b.left.you} · Enemy ships: {b.left.opp}
      </p>
    </>
  )
}
