import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { ASPECT, COLOURS, GLYPHS, StarBoard } from './chinese/Board'
import { COUNTS, aiMove, destinations, isOver, move, newGame, progress, scoreFor, type CState, type Count, type Level } from './chinese/rules'
import './chinese/chinese.css'

/** Pause before each computer move, so the player can follow the hops. */
const THINK_MS = 350
const LEVELS: [Level, string][] = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]

export function ChineseCheckers({ onFinish, seed }: GameProps) {
  const base = seed ?? 'chinese-checkers'
  const [level, setLevel] = useState<Level>('normal')
  const [players, setPlayers] = useState<Count>(2)
  const [run, setRun] = useState(0)
  const [game, setGame] = useState<CState>(() => newGame(2))
  const [picked, setPicked] = useState<number | null>(null)
  const random = useMemo(() => createRandom(`${base}:${run}`), [base, run])
  const startedAt = useRef(0)
  const over = isOver(game)
  const thinking = !over && game.turn !== 1

  // A run is reported once, from the handler or timer that ends it, never from a state updater.
  const commit = useCallback(
    (next: CState) => {
      setGame(next)
      if (isOver(next)) {
        onFinish({
          score: scoreFor(next),
          durationMs: Date.now() - startedAt.current,
          won: next.winner === 1,
          stats: { turns: next.turns[0], players: next.players, progress: progress(next, 1), called: next.called ? 1 : 0 },
        })
      }
    },
    [onFinish],
  )

  useEffect(() => {
    if (!thinking) return
    const timer = setTimeout(() => {
      const m = aiMove(game, random, level)
      if (m) commit(move(game, m.from, m.to))
    }, THINK_MS)
    return () => clearTimeout(timer)
  }, [thinking, game, random, level, commit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPicked(null)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const targets = useMemo(() => new Set(picked === null || game.turn !== 1 ? [] : destinations(game, picked)), [game, picked])

  const click = (i: number) => {
    if (over || thinking) return
    if (game.cells[i] === 1) setPicked(picked === i ? null : i)
    else if (picked !== null && targets.has(i)) {
      if (game.moves === 0) startedAt.current = Date.now()
      setPicked(null)
      commit(move(game, picked, i))
    }
  }

  const restart = (n: Count = players, l: Level = level) => {
    setPlayers(n)
    setLevel(l)
    setRun((r) => r + 1)
    setGame(newGame(n))
    setPicked(null)
    startedAt.current = 0
  }

  const status = over ? (game.winner === 1 ? 'You win!' : `${COLOURS[game.winner - 1]} wins`) : thinking ? `${COLOURS[game.turn - 1]} is thinking…` : picked === null ? 'Your move: pick a red man' : 'Pick a highlighted hole'

  return (
    <div className="cc" style={{ '--ar': ASPECT } as React.CSSProperties}>
      <div className="game-toolbar c4-bar">
        <div>
          <small>Turn</small>
          <strong className="c4-status" aria-live="polite">{status}</strong>
        </div>
        <button onClick={() => restart()}><RotateCcw size={15} />New</button>
      </div>
      <div className="cc-opts">
        <label>Players<select aria-label="Players" value={players} onChange={(e) => restart(Number(e.target.value) as Count)}>{COUNTS.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
        <label>Computer<select aria-label="Computer level" value={level} onChange={(e) => restart(players, e.target.value as Level)}>{LEVELS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      </div>
      <div className="cc-score" aria-label="Progress">
        {Array.from({ length: game.players }, (_, i) => (
          <span key={i} data-turn={!over && game.turn === i + 1 ? 'true' : undefined}>
            <i aria-hidden="true">{GLYPHS[i]}</i> {i === 0 ? 'You' : COLOURS[i]} <b>{progress(game, i + 1)}%</b>
          </span>
        ))}
      </div>
      <StarBoard cells={game.cells} selected={picked} targets={targets} last={game.last} disabled={over || thinking} onPoint={click} />
      <p className="game-help">Step to a neighbouring hole, or hop over any man, and keep hopping. Move all ten red men across to the opposite point first. Tap a man, then a highlighted hole (or Tab and Enter). The game is called after 120 turns each; the furthest advanced wins.</p>
      {over ? (
        <div className="game-over">
          <h3>{status}</h3>
          <p>{game.turns[0]} turns · score {scoreFor(game)}{game.called ? ' · called at the turn limit' : ''}</p>
          <button className="primary-btn" onClick={() => restart()}>Play again</button>
        </div>
      ) : null}
    </div>
  )
}
