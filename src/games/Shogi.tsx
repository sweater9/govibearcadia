import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { Hand, ShogiBoard } from './shogi/Board'
import type { Labels } from './shogi/names'
import { chooseMove, type Level } from './shogi/ai'
import { KING, RULES_NOTE, apply, isOver, legalMoves, make, newGame, ownerOf, scoreFor, type GState, type Move, type Owner } from './shogi/rules'
import './shogi/shogi.css'

/** Pause before the computer answers, so the player can follow the move. */
const THINK_MS = 350
type Mode = Level | 'two'
const MODES: [Mode, string][] = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['two', 'Two players']]
const NEXT_LABELS: Record<Labels, Labels> = { kanji: 'english', english: 'both', both: 'kanji' }
const LABEL_NAME: Record<Labels, string> = { kanji: 'Kanji', english: 'Letters', both: 'Both' }
const REASON: Record<string, string> = { checkmate: 'by checkmate', 'no-moves': 'the other side has no legal move', sennichite: 'the position repeated four times', impasse: 'impasse: both kings reached the other camp', 'move-limit': 'move limit reached' }

type Pick = { from: number } | { drop: number } | null

export function Shogi({ onFinish, seed }: GameProps) {
  const base = seed ?? 'shogi'
  const [mode, setMode] = useState<Mode>('normal')
  const [labels, setLabels] = useState<Labels>('kanji')
  const [run, setRun] = useState(0)
  const [game, setGame] = useState<GState>(() => newGame())
  const [pick, setPick] = useState<Pick>(null)
  const [ask, setAsk] = useState<Move[] | null>(null)
  const random = useMemo(() => createRandom(`${base}:${run}`), [base, run])
  const startedAt = useRef(0)
  const over = isOver(game)
  const vsComputer = mode !== 'two'
  const thinking = !over && vsComputer && game.turn === 2
  const mover: Owner = game.turn
  const moves = useMemo(() => legalMoves(game), [game])

  // A run is reported once, from the handler or timer that ends it, never from a state updater.
  // Games between two people on one screen are not scored, so they cannot set a personal best.
  const commit = useCallback(
    (next: GState) => {
      setGame(next)
      if (isOver(next) && mode !== 'two') {
        onFinish({
          score: scoreFor(next),
          durationMs: Date.now() - startedAt.current,
          won: next.winner === 1,
          stats: { moves: next.moves, outcome: next.winner === 1 ? 1 : next.winner === 2 ? -1 : 0, check: next.check ? 1 : 0 },
        })
      }
    },
    [onFinish, mode],
  )

  useEffect(() => {
    if (!thinking) return
    const timer = setTimeout(() => {
      const m = chooseMove(game, random, mode as Level)
      if (m) commit(apply(game, m))
    }, THINK_MS)
    return () => clearTimeout(timer)
  }, [thinking, game, random, mode, commit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPick(null)
        setAsk(null)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const play = (m: Move) => {
    if (game.moves === 0) startedAt.current = Date.now()
    setPick(null)
    setAsk(null)
    commit(apply(game, m))
  }

  const mine = vsComputer ? 1 : mover
  const canAct = !over && !thinking && game.turn === mine
  const targets = useMemo(() => {
    if (!pick) return new Set<number>()
    return new Set(moves.filter((m) => ('from' in pick ? m.from === pick.from && !m.drop : m.drop === pick.drop)).map((m) => m.to))
  }, [moves, pick])

  const clickSquare = (i: number) => {
    if (!canAct) return
    setAsk(null)
    if (pick && targets.has(i)) {
      const options = moves.filter((m) => m.to === i && ('from' in pick ? m.from === pick.from && !m.drop : m.drop === pick.drop))
      if (options.length > 1) setAsk(options)
      else play(options[0])
    } else if (ownerOf(game.cells[i]) === mine) setPick(pick && 'from' in pick && pick.from === i ? null : { from: i })
    else setPick(null)
  }
  const clickHand = (kind: number) => {
    if (!canAct) return
    setAsk(null)
    setPick(pick && 'drop' in pick && pick.drop === kind ? null : { drop: kind })
  }

  const restart = (m: Mode = mode) => {
    setMode(m)
    setRun((r) => r + 1)
    setGame(newGame())
    setPick(null)
    setAsk(null)
    startedAt.current = 0
  }

  const who = vsComputer ? (mover === 1 ? 'Your move' : 'Computer is thinking…') : mover === 1 ? 'Black to move' : 'White to move'
  const status = over
    ? game.draw ? `Draw: ${REASON[game.reason] ?? game.reason}` : game.winner === 1 ? (vsComputer ? 'You win!' : 'Black wins!') : vsComputer ? 'Computer wins' : 'White wins!'
    : `${game.check ? 'Check! ' : ''}${who}`
  const checkSquare = game.check && !over ? game.cells.indexOf(make(KING, game.turn)) : -1
  const heldSel = pick && 'drop' in pick ? pick.drop : 0

  return (
    <div className="sg">
      <div className="game-toolbar c4-bar sg-bar">
        <div>
          <small>Turn</small>
          <strong className="c4-status" aria-live="polite">{status}</strong>
        </div>
        <select aria-label="Opponent" value={mode} onChange={(e) => restart(e.target.value as Mode)}>
          {MODES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <button onClick={() => restart()}><RotateCcw size={15} />New</button>
      </div>
      <div className="sg-play">
        <div className="sg-tools">
          <Hand owner={2} hand={game.hand[1]} selected={game.turn === 2 && !vsComputer ? heldSel : 0} enabled={canAct && game.turn === 2 && !vsComputer} labels={labels} onPick={clickHand} />
          <button type="button" onClick={() => setLabels(NEXT_LABELS[labels])} aria-label={`Piece labels: ${LABEL_NAME[labels]}. Change`}>{LABEL_NAME[labels]}</button>
        </div>
        <ShogiBoard cells={game.cells} selected={pick && 'from' in pick ? pick.from : null} targets={targets} last={game.last} checkSquare={checkSquare} disabled={!canAct} labels={labels} onSquare={clickSquare} />
        <Hand owner={1} hand={game.hand[0]} selected={game.turn === 1 ? heldSel : 0} enabled={canAct && game.turn === 1} labels={labels} onPick={clickHand} />
      </div>
      {ask ? (
        <div className="sg-ask" role="group" aria-label="Promote this piece?">
          <span>Promote?</span>
          <button className="primary-btn" onClick={() => play(ask.find((m) => m.promote)!)}>Promote</button>
          <button className="secondary-btn" onClick={() => play(ask.find((m) => !m.promote)!)}>Don&apos;t promote</button>
        </div>
      ) : null}
      <p className="game-help">Tap a piece, then a highlighted square. Tap a piece in your hand to drop it. Reach the far three rows to promote. You are black and move first. {RULES_NOTE}</p>
      {over ? (
        <div className="game-over">
          <h3>{status}</h3>
          <p>{game.moves} moves · score {scoreFor(game)}{game.winner ? ` · ${REASON[game.reason] ?? ''}` : ''}</p>
          <button className="primary-btn" onClick={() => restart()}>Play again</button>
        </div>
      ) : null}
    </div>
  )
}

