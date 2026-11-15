import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { GoBoard } from './go/Board'
import { KOMI, SIZES, aiChoose, isLegal, isOver, margin, newGame, pass, play, scoreArea, scoreFor, type GState, type Level, type Size } from './go/rules'
import './go/go.css'

/** Pause before the computer answers, so the player can follow. */
const THINK_MS = 450
const LEVELS: [Level, string][] = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]

export function Go({ onFinish, seed }: GameProps) {
  const base = seed ?? 'go'
  const [size, setSize] = useState<Size>(9)
  const [level, setLevel] = useState<Level>('normal')
  const [run, setRun] = useState(0)
  const [game, setGame] = useState<GState>(() => newGame(9))
  const random = useMemo(() => createRandom(`${base}:${run}`), [base, run])
  const startedAt = useRef(0)
  const over = isOver(game)
  const thinking = !over && game.turn === 2

  // A run is reported once, from the handler or timer that ends it, never from a state updater.
  const commit = useCallback(
    (next: GState) => {
      setGame(next)
      if (isOver(next)) {
        const m = margin(next)
        const a = scoreArea(next.cells, next.size)
        onFinish({
          score: scoreFor(next),
          durationMs: Date.now() - startedAt.current,
          won: m > 0,
          stats: { margin: Math.round(m), size: next.size, captures: next.captures[0], black: a.black, white: a.white },
        })
      }
    },
    [onFinish],
  )

  useEffect(() => {
    if (!thinking) return
    const timer = setTimeout(() => {
      const c = aiChoose(game, random, level)
      commit(c === 'pass' ? pass(game) : play(game, c))
    }, THINK_MS)
    return () => clearTimeout(timer)
  }, [thinking, game, random, level, commit])

  const begin = () => {
    if (game.moves === 0) startedAt.current = Date.now()
  }
  const click = (p: number) => {
    if (over || thinking || !isLegal(game, p)) return
    begin()
    commit(play(game, p))
  }
  const passTurn = useCallback(() => {
    if (over || thinking) return
    begin()
    commit(pass(game))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over, thinking, game, commit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'p' || e.key === 'P') passTurn()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [passTurn])

  const restart = (s: Size = size, l: Level = level) => {
    setSize(s)
    setLevel(l)
    setRun((r) => r + 1)
    setGame(newGame(s))
    startedAt.current = 0
  }

  const area = scoreArea(game.cells, game.size)
  const m = margin(game)
  const status = over
    ? m > 0 ? `You win by ${m}` : `Computer wins by ${-m}`
    : thinking
      ? game.passes ? 'Computer is deciding…' : 'Computer is thinking…'
      : game.passes ? 'Computer passed: pass to end, or play on' : 'Your move (black)'

  return (
    <div className="go">
      <div className="game-toolbar c4-bar">
        <div>
          <small>Turn</small>
          <strong className="c4-status" aria-live="polite">{status}</strong>
        </div>
        <button onClick={() => restart()}><RotateCcw size={15} />New</button>
      </div>
      <div className="go-opts">
        <label>Board<select aria-label="Board size" value={size} onChange={(e) => restart(Number(e.target.value) as Size)}>{SIZES.map((n) => <option key={n} value={n}>{n}×{n}</option>)}</select></label>
        <label>Computer<select aria-label="Computer level" value={level} onChange={(e) => restart(size, e.target.value as Level)}>{LEVELS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <button className="secondary-btn go-pass" onClick={passTurn} disabled={over || thinking}>Pass</button>
      </div>
      <div className="go-info" aria-label="Score so far">
        <span>Black <b>{area.black}</b></span>
        <span>White <b>{area.white}</b> + {KOMI} komi</span>
        <span>Captured <b>{game.captures[0]}</b> / <b>{game.captures[1]}</b></span>
      </div>
      <GoBoard size={game.size} cells={game.cells} last={game.last} disabled={over || thinking} onPoint={click} />
      <p className="game-help">Tap a point to place a stone (or Tab and Enter). Surround stones to capture them; you may not play where you would have no liberties, or repeat an earlier position. Press Pass (or P) when you are done: two passes in a row end the game. Counting is by area, with 6.5 komi to white, and dead stones are not removed, so capture or surround what you want counted before you pass. You are black.</p>
      {over ? (
        <div className="game-over">
          <h3>{status}</h3>
          <div className="go-result">
            <span>Black {area.black} ({area.blackStones} stones + {area.blackTerritory} territory)</span>
            <span>White {area.white} ({area.whiteStones} stones + {area.whiteTerritory} territory) + {KOMI} komi</span>
            <span>Score {scoreFor(game)}</span>
          </div>
          <button className="primary-btn" onClick={() => restart()}>Play again</button>
        </div>
      ) : null}
    </div>
  )
}
