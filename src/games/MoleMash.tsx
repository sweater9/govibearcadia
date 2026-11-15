import type { GameProps } from '../types'
import { DURATION, HOLES, newGame, score, start, step, timeLeft, whack, type State } from './mole/rules'
import { PauseButton, RunOverlay } from './shared/RunOverlay'
import { useKeys, useRun } from './shared/useRun'
import './mole/mole.css'

const EMOJI = { mole: '🐹', gold: '⭐', bomb: '💣' } as const
const LABEL = { mole: 'Mole', gold: 'Golden mole', bomb: 'Bomb' } as const
/** A focused hole must not also start the game with Space or Enter. */
const stopSpaceAndEnter = (e: React.KeyboardEvent) => {
  if (e.key === ' ' || e.key === 'Enter') e.stopPropagation()
}

export function MoleMash({ onFinish, seed }: GameProps) {
  const { game, phase, dispatch, best, paused, setPaused, restart } = useRun<State>({
    seed,
    onFinish,
    create: newGame,
    step,
    phase: (s) => s.status,
    result: (s) => ({ score: score(s), won: false, stats: { hits: s.hits, misses: s.misses, bombs: s.bombs } }),
  })

  // Number keys 1-9 hit the holes in reading order (1 is top-left), like a phone keypad turned upside down.
  useKeys((k) => {
    if (/^[1-9]$/.test(k)) dispatch((s) => whack(s, Number(k) - 1))
    else if ((k === ' ' || k === 'enter') && phase === 'ready') dispatch(start)
    else return false
    return true
  })

  return (
    <div className="mm">
      <div className="mm-stats">
        <span>Score <b>{score(game)}</b></span>
        <span>Time <b>{Math.ceil(timeLeft(game) / 1000)}s</b></span>
        {best > 0 && <span>Best <b>{best}</b></span>}
        <PauseButton phase={phase} paused={paused} onPause={() => setPaused(true)} />
      </div>
      <div className="mm-board" data-status={game.status}>
        <div className="mm-grid">
          {Array.from({ length: HOLES }, (_, i) => {
            const pop = game.holes[i]
            return (
              <button key={i} type="button" className="mm-hole" data-kind={pop?.kind ?? 'empty'} aria-label={pop ? `${LABEL[pop.kind]}, hole ${i + 1}` : `Hole ${i + 1}`}
                onPointerDown={(e) => { e.preventDefault(); dispatch((s) => whack(s, i)) }} onKeyDown={stopSpaceAndEnter}>
                {pop && <span className="mm-pop" aria-hidden="true">{EMOJI[pop.kind]}</span>}
              </button>
            )
          })}
        </div>
        <RunOverlay
          className="mm-over"
          phase={phase}
          paused={paused}
          onResume={() => setPaused(false)}
          ready={{ title: 'Mole Mash', text: `Tap the moles before they duck. Stars are worth triple. Leave the bombs alone. Keys 1 to 9 work too. ${DURATION / 1000} seconds.`, action: 'Start', onAction: () => dispatch(start) }}
          over={{ title: "Time's up!", text: `Score ${score(game)} · ${game.hits} whacked · ${game.misses} got away`, action: 'Play again', onAction: restart }}
        />
      </div>
    </div>
  )
}
