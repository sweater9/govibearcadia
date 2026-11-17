import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { GOAL, aiMove, captureOptions, cardName, isOver, newGame, next, play, rankLabel, scoreFor, suitOf, type HandScore, type Level, type SState } from './scopa/rules'
import './scopa/scopa.css'

/** Pause before the computer plays, so the player can follow. */
const THINK_MS = 700
const LEVELS: [Level, string][] = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]
const COLOURS = ['#d9a21b', '#c62832', '#2b5fc4', '#2f8f4a']

/** Drawn suit symbols, so no image files are needed. */
function Suit({ suit }: { suit: number }) {
  const c = COLOURS[suit]
  const common = { fill: 'none', stroke: c, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {suit === 0 ? <><circle cx="12" cy="12" r="9" {...common} fill={`${c}33`} /><circle cx="12" cy="12" r="4.5" {...common} /></> : null}
      {suit === 1 ? <path d="M5 4h14c0 7-3 10-7 10S5 11 5 4zM12 14v6M8 21h8" {...common} fill={`${c}33`} /> : null}
      {suit === 2 ? <path d="M12 2l2.5 3V15h-5V5zM6 15h12M12 15v7" {...common} fill={`${c}33`} /> : null}
      {suit === 3 ? <path d="M9 3h6l1 5-2 3v10h-4V11L8 8z" {...common} fill={`${c}33`} /> : null}
    </svg>
  )
}

function Card({ id, onClick, pressed, disabled, hl, hotkey }: { id: number; onClick?: () => void; pressed?: boolean; disabled?: boolean; hl?: boolean; hotkey?: number }) {
  const inner = <><span>{rankLabel(id)}</span><Suit suit={suitOf(id)} /></>
  if (!onClick) return <div className="sc-card" data-hl={hl || undefined} data-card={id} role="img" aria-label={cardName(id)}>{inner}</div>
  return <button className="sc-card" data-card={id} aria-label={`${cardName(id)}${hotkey ? `, key ${hotkey}` : ''}`} aria-pressed={pressed} disabled={disabled} onClick={onClick}>{inner}</button>
}
const Back = () => <div className="sc-card" data-back="true" aria-hidden="true" />

function Summary({ h }: { h: HandScore }) {
  const row = (label: string, a: string | number, b: string | number, win: 0 | 1 | null) => (
    <tr><td>{label}</td><td data-win={win === 0 || undefined}>{a}</td><td data-win={win === 1 || undefined}>{b}</td></tr>
  )
  return (
    <div className="sc-sum">
      <h4>Hand scored</h4>
      <table>
        <thead><tr><th /><th>You</th><th>Computer</th></tr></thead>
        <tbody>
          {row('Most cards', h.cards[0], h.cards[1], h.awards.cards)}
          {row('Most coins', h.coins[0], h.coins[1], h.awards.coins)}
          {row('Seven of coins', h.settebello === 0 ? '✓' : '', h.settebello === 1 ? '✓' : '', h.awards.settebello)}
          {row('Primiera', h.primiera[0], h.primiera[1], h.awards.primiera)}
          {row('Scope', h.scope[0], h.scope[1], null)}
          <tr><td><strong>Points</strong></td><td><strong>{h.points[0]}</strong></td><td><strong>{h.points[1]}</strong></td></tr>
        </tbody>
      </table>
    </div>
  )
}

export function Scopa({ onFinish, seed }: GameProps) {
  const [level, setLevel] = useState<Level>('normal')
  const base = seed ?? 'scopa'
  const [run, setRun] = useState(0)
  const [game, setGame] = useState<SState>(() => newGame(base))
  const [sel, setSel] = useState<number | null>(null)
  const [preview, setPreview] = useState<number[]>([])
  const random = useMemo(() => createRandom(`${base}:${run}:ai`), [base, run])
  const startedAt = useRef(0)
  const over = isOver(game)

  // A run is reported once, from the handler or timer that ends it, never from a state updater.
  const commit = useCallback(
    (s: SState) => {
      setGame(s)
      if (isOver(s)) {
        onFinish({
          score: scoreFor(s),
          durationMs: Date.now() - startedAt.current,
          won: s.winner === 0,
          stats: { you: s.scores[0], computer: s.scores[1], hands: s.round, scope: s.scope[0] },
        })
      }
    },
    [onFinish],
  )

  useEffect(() => {
    if (game.phase !== 'play' || game.turn !== 1) return
    const timer = setTimeout(() => {
      const m = aiMove(game, random, level)
      if (m) commit(play(game, 1, m.card, m.take))
    }, THINK_MS)
    return () => clearTimeout(timer)
  }, [game, level, random, commit])

  const mine = game.hands[0]
  const myTurn = game.phase === 'play' && game.turn === 0
  const options = useMemo(() => (sel === null ? [] : captureOptions(game.table, sel)), [game.table, sel])

  const act = useCallback(
    (card: number, take: number[]) => {
      if (!startedAt.current) startedAt.current = Date.now()
      setSel(null)
      setPreview([])
      commit(play(game, 0, card, take))
    },
    [game, commit],
  )

  const pick = useCallback(
    (card: number) => {
      if (!myTurn) return
      const opts = captureOptions(game.table, card)
      if (opts.length <= 1) act(card, opts[0] ?? [])
      else setSel(card)
    },
    [myTurn, game.table, act],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape') {
        setSel(null)
        setPreview([])
        return
      }
      const n = Number(e.key)
      if (!Number.isInteger(n) || n < 1) return
      if (sel !== null) {
        if (n <= options.length) act(sel, options[n - 1])
      } else if (n <= mine.length) pick(mine[n - 1])
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const restart = (l: Level = level) => {
    setLevel(l)
    setRun((r) => r + 1)
    setGame(newGame(`${base}:${run + 1}`))
    setSel(null)
    setPreview([])
    startedAt.current = 0
  }

  const status = over ? (game.winner === 0 ? 'You win!' : 'Computer wins') : game.phase === 'summary' ? game.note : game.turn === 1 ? 'Computer is thinking…' : sel !== null ? 'Choose what to take' : 'Your move'
  const showSummary = (game.phase === 'summary' || over) && game.summary

  return (
    <div className="sc">
      <div className="game-toolbar c4-bar">
        <div>
          <small>{game.dealer === 0 ? 'You deal' : 'Computer deals'}</small>
          <strong className="c4-status" aria-live="polite">{status}</strong>
        </div>
        <button onClick={() => restart()}><RotateCcw size={15} />New</button>
      </div>
      <div className="sc-opts">
        <label>Computer<select aria-label="Computer level" value={level} onChange={(e) => restart(e.target.value as Level)}>{LEVELS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <span>Deck {game.draw.length}</span>
      </div>
      <div className="sc-score" aria-label="Score">
        <span>You <b>{game.scores[0]}</b> / {GOAL} · {game.captured[0].length} cards · {game.scope[0]} scope</span>
        <span>Computer <b>{game.scores[1]}</b> · {game.captured[1].length} cards · {game.scope[1]} scope</span>
      </div>
      <div className="sc-felt">
        {showSummary ? (
          <Summary h={game.summary!} />
        ) : (
          <>
            <div className="sc-row" role="group" aria-label="Computer's cards">{game.hands[1].map((c) => <Back key={c} />)}</div>
            <div className="sc-row sc-table" aria-label="Cards on the table">{game.table.map((c) => <Card key={c} id={c} hl={preview.includes(c)} />)}</div>
            <p className="sc-note" role="status">{game.note}</p>
            {sel !== null ? (
              <div className="sc-choices" aria-label="Choose what to take">
                {options.map((o, i) => (
                  <button key={o.join('-')} onMouseEnter={() => setPreview(o)} onFocus={() => setPreview(o)} onMouseLeave={() => setPreview([])} onClick={() => act(sel, o)}>
                    {i + 1}. Take {o.map(rankLabel).join(' + ')}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="sc-row" role="group" aria-label="Your cards">
              {mine.map((c, i) => <Card key={c} id={c} hotkey={i + 1} pressed={sel === null ? undefined : sel === c} disabled={!myTurn} onClick={() => pick(c)} />)}
            </div>
          </>
        )}
        {game.phase === 'summary' ? <button className="primary-btn" onClick={() => commit(next(game))}>Next hand</button> : null}
      </div>
      <p className="game-help">Play a card to take a table card of the same value, or cards that add up to it. A matching card must be taken. Clearing the table is a scopa. Most cards, most coins, the seven of coins and primiera score each hand. First to {GOAL} wins. Tap a card or press 1 to 3; when asked what to take, tap a choice or press its number.</p>
      {over ? (
        <div className="game-over">
          <h3>{status}</h3>
          <p>{game.scores[0]} to {game.scores[1]} · score {scoreFor(game)}</p>
          <button className="primary-btn" onClick={() => restart()}>Play again</button>
        </div>
      ) : null}
    </div>
  )
}
