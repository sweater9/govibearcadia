import type { GameProps } from '../types'
import { PauseButton, RunOverlay } from './shared/RunOverlay'
import { useKeys, useRun } from './shared/useRun'
import { CAR_H, LANES, PLAYER_TOP, move, newGame, score, speedAt, start, step, type State } from './traffic/rules'
import './traffic/traffic.css'

/** A focused pad button must not also start the game with Space or Enter; every other key (arrows, P) still reaches the game. */
const stopSpaceAndEnter = (e: React.KeyboardEvent) => {
  if (e.key === ' ' || e.key === 'Enter') e.stopPropagation()
}
const TINTS = ['#ff7a59', '#ffd166', '#9b8cff', '#5eead4', '#f472b6']

export function TrafficDodger({ onFinish, seed }: GameProps) {
  const { game, phase, dispatch, best, paused, setPaused, restart } = useRun<State>({
    seed,
    onFinish,
    create: newGame,
    step,
    phase: (s) => (s.status === 'crashed' ? 'over' : s.status),
    result: (s) => ({ score: score(s), won: false, stats: { distance: Math.floor(s.distance), passed: s.passed } }),
  })

  useKeys((k) => {
    if (k === 'arrowleft' || k === 'a') dispatch((s) => move(s, -1))
    else if (k === 'arrowright' || k === 'd') dispatch((s) => move(s, 1))
    else if ((k === ' ' || k === 'enter') && phase === 'ready') dispatch(start)
    else return false
    return true
  })

  const { status, lane, cars } = game
  const speed = speedAt(game.distance)
  return (
    <div className="tr">
      <div className="tr-stats">
        <span>Score <b aria-live="off">{score(game)}</b></span>
        <span>Speed <b>{Math.round(speed * 1.6)} km/h</b></span>
        {best > 0 && <span>Best <b>{best}</b></span>}
        <PauseButton phase={phase} paused={paused} onPause={() => setPaused(true)} />
      </div>
      <div
        className="tr-field"
        data-status={status}
        data-lane={lane}
        style={{ '--lanes': LANES, '--road': `${(game.distance * 4) % 100}%` } as React.CSSProperties}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          const box = e.currentTarget.getBoundingClientRect()
          dispatch((s) => move(s, e.clientX < box.left + box.width / 2 ? -1 : 1))
        }}
      >
        {cars.map((c) => <span key={c.id} className="tr-car" style={{ left: `${(c.lane * 100) / LANES}%`, top: `${c.y}%`, height: `${CAR_H}%`, '--tint': TINTS[c.id % TINTS.length] } as React.CSSProperties} />)}
        <span className="tr-car tr-me" role="img" aria-label={`Your car, lane ${lane + 1} of ${LANES}`} style={{ left: `${(lane * 100) / LANES}%`, top: `${PLAYER_TOP}%`, height: `${CAR_H}%` }} />
        <RunOverlay
          className="tr-over"
          phase={phase}
          paused={paused}
          onResume={() => setPaused(false)}
          ready={{ title: 'Traffic Dodger', text: 'Switch lanes to avoid the cars. Left and right keys, or tap the sides.', action: 'Start', onAction: () => dispatch(start) }}
          over={{ title: 'Crash!', text: `Score ${score(game)} · ${Math.floor(game.distance)} m · ${game.passed} cars passed`, action: 'Play again', onAction: restart }}
        />
      </div>
      <div className="tr-pad">
        <button type="button" aria-label="Move left" onPointerDown={(e) => { e.stopPropagation(); dispatch((s) => move(s, -1)) }} onKeyDown={stopSpaceAndEnter}>◀</button>
        <button type="button" aria-label="Move right" onPointerDown={(e) => { e.stopPropagation(); dispatch((s) => move(s, 1)) }} onKeyDown={stopSpaceAndEnter}>▶</button>
      </div>
    </div>
  )
}
