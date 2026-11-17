import { levelTarget } from '../lib/levels'
import type { GameId } from '../types'

type Props = {
  gameId: GameId
  level: number
  /** Highest level cleared so far on this device. */
  cleared: number
  /** The run that just ended on this level, if any. */
  last: { score: number; passed: boolean } | null
  onPick: (level: number) => void
  onNext: () => void
  onRetry: () => void
}

const fmt = (n: number) => n.toLocaleString('en-US')

/**
 * Level picker and result for the score-chase games. It is one row above the game, and a finished run
 * replaces the target text in that same row, so the board never moves.
 */
export function LevelBar({ gameId, level, cleared, last, onPick, onNext, onRetry }: Props) {
  const unlocked = Array.from({ length: cleared + 1 }, (_, i) => i + 1)
  const target = levelTarget(gameId, level)
  return (
    <div className="level-bar" data-testid="level-bar">
      <label>
        Level{' '}
        <select value={level} onChange={(e) => onPick(Number(e.target.value))} aria-label="Level">
          {unlocked.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      {last ? (
        <p className="level-result" role="status">
          <span>{last.passed ? `Cleared with ${fmt(last.score)}` : `${fmt(last.score)} of ${fmt(target)}: not cleared`}</span>
          {last.passed ? (
            <button className="primary-btn" onClick={onNext}>
              Next level
            </button>
          ) : (
            <button className="secondary-btn" onClick={onRetry}>
              Retry level {level}
            </button>
          )}
        </p>
      ) : (
        <span>
          Clear it with {fmt(target)} points{cleared >= level ? ' · cleared' : ''}
        </span>
      )}
    </div>
  )
}
