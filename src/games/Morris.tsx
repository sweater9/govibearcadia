import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { byStrength } from '../lib/computerPlayers'
import { MorrisBoard } from './morris/Board'
import { aiPly, apply, interact, isOver, menLeft, millPoints, newGame, phase, removable, scoreFor, slideTargets, type Level, type MState, type Ply } from './morris/rules'
import './morris/morris.css'

/** Pause before the computer answers, so the player can follow each move. */
const THINK_MS = 550
type Mode = Level | 'two'
const MODES: [Mode, string][] = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['two', 'Two players']]

export function NineMensMorris({ onFinish, seed, computer }: GameProps) {
  const [mode, setMode] = useState<Mode>(() => byStrength<Mode>(computer, ['easy', 'easy', 'normal', 'normal', 'hard'], 'normal'))
  const random = useMemo(() => createRandom(seed), [seed])
  const [game, setGame] = useState<MState>(() => newGame())
  const [picked, setPicked] = useState<number | null>(null)
  const startedAt = useRef(0)
  const over = isOver(game)
  const vsComputer = mode !== 'two'
  const thinking = !over && vsComputer && game.turn === 2

  // A run is reported once, from the handler or timer that ends it, never from a state updater.
  // Games on one screen between two people are not scored, so they cannot set a personal best.
  const commit = useCallback(
    (next: MState) => {
      setGame(next)
      if (isOver(next) && mode !== 'two') {
        onFinish({
          score: scoreFor(next),
          durationMs: Date.now() - startedAt.current,
          won: next.winner === 1,
          stats: { moves: next.moves, men: menLeft(next, 1), outcome: next.winner === 1 ? 1 : next.winner === 2 ? -1 : 0 },
        })
      }
    },
    [onFinish, mode],
  )

  const play = useCallback(
    (ply: Ply) => {
      if (game.moves === 0) startedAt.current = Date.now()
      setPicked(null)
      commit(apply(game, ply))
    },
    [game, commit],
  )

  const click = (p: number) => {
    if (over || thinking) return
    const r = interact(game, game.turn, picked, p)
    if (r.ply) play(r.ply)
    else setPicked(r.select)
  }

  useEffect(() => {
    if (!thinking) return
    const timer = setTimeout(() => {
      const ply = aiPly(game, random, mode as Level)
      if (ply) commit(apply(game, ply))
    }, THINK_MS)
    return () => clearTimeout(timer)
  }, [thinking, game, random, mode, commit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPicked(null)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const restart = (m: Mode = mode) => {
    setMode(m)
    setGame(newGame())
    setPicked(null)
  }

  const ph = phase(game)
  const targets = useMemo(() => slideTargets(game, picked), [game, picked])
  const takeable = useMemo(() => new Set(!over && ph === 'remove' && !thinking ? removable(game) : []), [game, ph, over, thinking])
  const mills = useMemo(() => millPoints(game.cells), [game.cells])
  const who = vsComputer ? 'You' : game.turn === 1 ? 'Red' : 'Blue'
  const status = over
    ? game.winner === 1
      ? vsComputer ? 'You win!' : 'Red wins!'
      : game.winner === 2 ? (vsComputer ? 'Computer wins' : 'Blue wins!') : 'Draw'
    : thinking
      ? 'Computer is thinking…'
      : ph === 'remove' ? `${who}: mill! Remove a man` : ph === 'place' ? `${who}: place a man` : `${who}: slide a man`

  return (
    <div className="nm">
      <div className="game-toolbar c4-bar">
        <div>
          <small>Turn</small>
          <strong className="c4-status" aria-live="polite">{status}</strong>
        </div>
        <button onClick={() => restart()}>
          <RotateCcw size={15} />
          New
        </button>
      </div>
      <div className="nm-opts">
        <label>
          Opponent
          <select value={mode} onChange={(e) => restart(e.target.value as Mode)} aria-label="Opponent">
            {MODES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
      </div>
      <div className="nm-hands" aria-label="Men in hand">
        <span>Red <b>{game.hand[0]}</b> to place · <b>{menLeft(game, 1)}</b> in play</span>
        <span>Blue <b>{game.hand[1]}</b> to place · <b>{menLeft(game, 2)}</b> in play</span>
      </div>
      <MorrisBoard cells={game.cells} selected={picked} targets={targets} removable={takeable} mills={mills} disabled={over || thinking} onPoint={click} />
      <p className="game-help">Place nine men, then slide them along the lines. Three in a row is a mill and lets you remove an opponent's man (not one in a mill, unless all are). Down to three men, you may fly. Fewer than three, or no move, loses. You are red and go first.</p>
      {over ? (
        <div className="game-over">
          <h3>{status}</h3>
          <p>{game.moves} moves · score {scoreFor(game)}</p>
          <button className="primary-btn" onClick={() => restart()}>Play again</button>
        </div>
      ) : null}
    </div>
  )
}
