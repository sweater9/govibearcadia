import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { BattleshipBoard } from './battleship/Board'
import { act, aiShot, newRoom, scoreFor, viewFor, type Room } from './battleship/rules'

/** Pause before the computer fires, so the player can follow the game. */
const THINK_MS = 600

export function Battleship({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [room, setRoom] = useState<Room>(() => newRoom(random))
  const startedAt = useRef(0)
  const view = viewFor(room, 0)
  const phase = room.phase
  const thinking = phase === 'battle' && room.turn === 1

  // A run is reported once, from the handler or timer that ends it, never from a state updater.
  const commit = useCallback(
    (next: Room) => {
      setRoom(next)
      if (next.phase === 'over') {
        const shots = viewFor(next, 0).board.moves
        const won = next.winner === 0
        onFinish({ score: scoreFor(won, shots), durationMs: Date.now() - startedAt.current, won, stats: { moves: shots, outcome: won ? 1 : -1 } })
      }
    },
    [onFinish],
  )

  const apply = (seat: 0 | 1, message: Record<string, unknown>) => {
    const r = act(room, seat, message, random)
    return r.ok ? r.room : room
  }

  const ready = () => {
    startedAt.current = Date.now()
    // The computer is always ready; the battle starts as soon as the player is.
    const first = act(room, 0, { type: 'ready' }, random)
    if (!first.ok) return
    const both = act(first.room, 1, { type: 'ready' }, random)
    if (both.ok) setRoom(both.room)
  }

  useEffect(() => {
    if (!thinking) return
    const timer = setTimeout(() => {
      const r = act(room, 1, { type: 'move', cell: aiShot(viewFor(room, 1), random) }, random)
      if (r.ok) commit(r.room)
    }, THINK_MS)
    return () => clearTimeout(timer)
  }, [thinking, room, random, commit])

  const restart = () => setRoom(newRoom(random))
  const status = phase === 'over' ? (room.winner === 0 ? 'You win!' : 'Computer wins') : phase === 'placing' ? 'Place your fleet' : thinking ? 'Computer is aiming…' : 'Your shot'

  return (
    <div className="bs">
      <div className="game-toolbar c4-bar">
        <div>
          <small>Turn</small>
          <strong className="c4-status" aria-live="polite">
            {status}
          </strong>
        </div>
        <button onClick={restart}>
          <RotateCcw size={15} />
          New
        </button>
      </div>
      <BattleshipBoard view={view} canFire={phase === 'battle' && !thinking} canPlace={phase === 'placing'} onFire={(cell) => commit(apply(0, { type: 'move', cell }))} onShuffle={() => setRoom(apply(0, { type: 'shuffle' }))} onReady={ready} />
      <p className="game-help">Shuffle until you like your fleet, then press Ready. Tap a square in the enemy waters to fire. Sink all five enemy ships before the computer sinks yours.</p>
      {phase === 'over' ? (
        <div className="game-over">
          <h3>{status}</h3>
          <p>
            {view.board.moves} shots · score {scoreFor(room.winner === 0, view.board.moves)}
          </p>
          <button className="primary-btn" onClick={restart}>
            Play again
          </button>
        </div>
      ) : null}
    </div>
  )
}
