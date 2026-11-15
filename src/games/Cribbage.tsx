import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { GOAL, SKUNK, SUITS, aiDiscard, aiPeg, discard, isOver, legalCards, newGame, next, play, rankOf, scoreFor, suitOf, type CState, type Level, type Who } from './cribbage/rules'
import './cribbage/cribbage.css'

/** Pause before the computer acts, so the player can follow. */
const THINK_MS = 650
const LEVELS: [Level, string][] = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]
const RANK = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const label = (id: number) => `${RANK[rankOf(id) - 1]} of ${['spades', 'hearts', 'diamonds', 'clubs'][suitOf(id)]}`

function Card({ id, onClick, pressed, disabled, hotkey }: { id: number; onClick?: () => void; pressed?: boolean; disabled?: boolean; hotkey?: number }) {
  const red = suitOf(id) === 1 || suitOf(id) === 2
  const face = <span>{RANK[rankOf(id) - 1]}<small>{SUITS[suitOf(id)]}</small></span>
  if (!onClick) return <div className="cb-card" data-red={red || undefined} role="img" aria-label={label(id)}>{face}</div>
  return (
    <button className="cb-card" data-red={red || undefined} data-card={id} aria-label={`${label(id)}${hotkey ? `, key ${hotkey}` : ''}`} aria-pressed={pressed} disabled={disabled} onClick={onClick}>{face}</button>
  )
}
const Back = () => <div className="cb-card" data-back="true" aria-hidden="true" />

export function Cribbage({ onFinish, seed }: GameProps) {
  const [level, setLevel] = useState<Level>('normal')
  const base = seed ?? 'cribbage'
  const [run, setRun] = useState(0)
  const [game, setGame] = useState<CState>(() => newGame(base))
  const [sel, setSel] = useState<number[]>([])
  const random = useMemo(() => createRandom(`${base}:${run}:ai`), [base, run])
  const startedAt = useRef(0)
  const over = isOver(game)

  // A run is reported once, from the handler or timer that ends it, never from a state updater.
  const commit = useCallback(
    (nextState: CState) => {
      setGame(nextState)
      if (isOver(nextState)) {
        const w = nextState.winner
        onFinish({
          score: scoreFor(nextState),
          durationMs: Date.now() - startedAt.current,
          won: w === 0,
          stats: { you: nextState.scores[0], computer: nextState.scores[1], deals: nextState.round, skunk: w === 0 && nextState.scores[1] < SKUNK ? 1 : 0 },
        })
      }
    },
    [onFinish],
  )
  const begin = () => {
    if (game.moves === 0 && !startedAt.current) startedAt.current = Date.now()
  }

  // The computer discards and pegs on a short delay.
  useEffect(() => {
    if (over) return
    let act: (() => CState) | null = null
    if (game.phase === 'discard' && game.hands[1].length === 6) act = () => discard(game, 1, aiDiscard(game, 1, level, random))
    else if (game.phase === 'peg' && game.turn === 1) act = () => play(game, 1, aiPeg(game, 1, level, random))
    if (!act) return
    const timer = setTimeout(() => commit(act!()), THINK_MS)
    return () => clearTimeout(timer)
  }, [game, level, random, over, commit])

  const mine = game.hands[0]
  const legal = useMemo(() => new Set(legalCards(game, 0)), [game])

  const pick = (id: number) => {
    if (over) return
    if (game.phase === 'discard' && mine.length === 6) {
      setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 2 ? [...s, id] : [s[1], id]))
    } else if (game.phase === 'peg' && legal.has(id)) {
      begin()
      commit(play(game, 0, id))
    }
  }
  const send = () => {
    if (sel.length !== 2) return
    begin()
    setSel([])
    commit(discard(game, 0, sel))
  }
  const advance = () => commit(next(game))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape') setSel([])
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= mine.length) pick(mine[n - 1])
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const restart = (l: Level = level) => {
    setLevel(l)
    setRun((r) => r + 1)
    setGame(newGame(`${base}:${run + 1}`))
    setSel([])
    startedAt.current = 0
  }

  const show = game.phase === 'show' || (over && game.shows.length > 0) ? game.shows[game.step] : null
  const dealerName = game.dealer === 0 ? 'You deal' : 'Computer deals'
  const status = over ? (game.winner === 0 ? 'You win!' : 'Computer wins') : game.note
  const choosing = game.phase === 'discard' && mine.length === 6
  const track = (who: Who, name: string) => (
    <div className="cb-track">
      <span>{name}</span>
      <div className="cb-bar" role="progressbar" aria-label={`${name} score`} aria-valuemin={0} aria-valuemax={GOAL} aria-valuenow={game.scores[who]}><i style={{ width: `${(game.scores[who] / GOAL) * 100}%` }} /></div>
      <b>{game.scores[who]} / {GOAL}</b>
    </div>
  )

  return (
    <div className="cb">
      <div className="game-toolbar c4-bar">
        <div>
          <small>{dealerName}</small>
          <strong className="c4-status" aria-live="polite">{status}</strong>
        </div>
        <button onClick={() => restart()}><RotateCcw size={15} />New</button>
      </div>
      <div className="cb-opts">
        <label>Computer<select aria-label="Computer level" value={level} onChange={(e) => restart(e.target.value as Level)}>{LEVELS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <span className="cb-dealer">{game.dealer === 0 ? 'Your crib' : "Computer's crib"}</span>
      </div>
      <div className="cb-tracks">{track(0, 'You')}{track(1, 'Computer')}</div>
      <div className="cb-felt">
        <div className="cb-row" aria-label="Computer's cards">
          {game.phase === 'show' || over ? null : Array.from({ length: game.hands[1].length }, (_, i) => <Back key={i} />)}
        </div>
        {game.phase === 'peg' ? (
          <div className="cb-info" aria-live="polite"><span>Cut <b>{RANK[rankOf(game.starter) - 1]}{SUITS[suitOf(game.starter)]}</b></span><span>Count <span className="cb-count">{game.count}</span></span></div>
        ) : null}
        {game.phase === 'peg' ? <div className="cb-row cb-pile" aria-label="Cards played">{game.pile.map((c, i) => <Card key={`${c}-${i}`} id={c} />)}</div> : null}
        {show ? (
          <div className="cb-show">
            <h4>{show.label}</h4>
            <div className="cb-row">{show.cards.map((c) => <Card key={c} id={c} />)}<Card id={game.starter} /></div>
            <ul>{show.score.items.length ? show.score.items.map((it) => <li key={it.label}>{it.label}: {it.points}</li>) : <li>No points</li>}</ul>
            <strong>{show.score.points} points</strong>
          </div>
        ) : null}
        {game.phase === 'discard' || game.phase === 'peg' ? (
          <div className="cb-row" aria-label="Your cards">
            {mine.map((c, i) => <Card key={c} id={c} hotkey={i + 1} pressed={choosing ? sel.includes(c) : undefined} disabled={over || (game.phase === 'peg' && !legal.has(c))} onClick={() => pick(c)} />)}
          </div>
        ) : null}
        {choosing ? <button className="primary-btn" disabled={sel.length !== 2} onClick={send}>Send to {game.dealer === 0 ? 'your' : "the computer's"} crib</button> : null}
        {game.phase === 'show' ? <button className="primary-btn" onClick={advance}>{game.step < 2 ? 'Continue' : 'Next deal'}</button> : null}
      </div>
      <p className="game-help">Choose two cards for the crib (the dealer owns it), then take turns playing cards up to 31, scoring fifteens, pairs and runs. Then count the hands. First to 121 wins. Tap or press 1 to 6.</p>
      {over ? (
        <div className="game-over">
          <h3>{status}</h3>
          <p>{game.scores[0]} to {game.scores[1]} · score {scoreFor(game)}{game.winner === 0 && game.scores[1] < SKUNK ? ' · skunk!' : ''}</p>
          <button className="primary-btn" onClick={() => restart()}>Play again</button>
        </div>
      ) : null}
    </div>
  )
}
