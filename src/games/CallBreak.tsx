import { useEffect, useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps, GameResult } from '../types'
import { chooseAction } from './callbreak/bot'
import { MAX_BID, MIN_BID, ROUNDS, apply, legalPlays, newGame, rankOf, suitOf, totals, winners, type Action, type State } from './callbreak/rules'
import './callbreak/callbreak.css'

const NAMES = ['You', 'West', 'North', 'East']
const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const RANK_NAMES = ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King']
const SUIT_PATH = [
  'M12 2c3 4 8 6.5 8 11a4.2 4.2 0 0 1-7 3.1c.2 2 .9 3.6 2.5 5.4h-7c1.6-1.8 2.3-3.4 2.5-5.4A4.2 4.2 0 0 1 4 13c0-4.5 5-7 8-11z',
  'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z',
  'M12 2l7 10-7 10-7-10z',
  'M12 2.5a4.3 4.3 0 0 0-3.2 7.2A4.5 4.5 0 1 0 11 16.6c-.1 1.9-.8 3.4-2.4 5h6.8c-1.6-1.6-2.3-3.1-2.4-5a4.5 4.5 0 1 0 2.2-6.9A4.3 4.3 0 0 0 12 2.5z',
]
const cardName = (c: number) => `${RANK_NAMES[rankOf(c)]} of ${SUIT_NAMES[suitOf(c)]}`
const tenths = (n: number) => (n / 10).toFixed(1)

function Suit({ suit }: { suit: number }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={SUIT_PATH[suit]} fill="currentColor" /></svg>
}
function Face({ card, small }: { card: number; small?: boolean }) {
  const s = suitOf(card)
  return <span className={`cb-face${small ? ' cb-small' : ''}`} data-red={s === 1 || s === 2 ? 'true' : undefined}><b>{RANKS[rankOf(card)]}</b><Suit suit={s} /></span>
}

export function CallBreak({ onFinish, seed }: GameProps) {
  const [base] = useState(() => seed ?? String(createRandom()()))
  const [game, setGameNumber] = useState(0)
  const [state, setState] = useState<State>(() => newGame(base))
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [reported, setReported] = useState(false)
  const [result, setResult] = useState<GameResult | null>(null)

  function commit(a: Action): boolean {
    const r = apply(state, a)
    if (!r.ok) return false
    setState(r.state)
    if (r.state.phase === 'over' && !reported) {
      setReported(true)
      const t = totals(r.state)
      const top = winners(r.state)
      const finished: GameResult = { score: Math.max(0, t[0]), durationMs: Math.max(0, Date.now() - startedAt), won: top.length === 1 && top[0] === 0, stats: { total: t[0], rounds: ROUNDS } }
      setResult(finished)
      onFinish(finished)
    }
    return true
  }

  // Computers move after a short pause so you can follow what happened.
  useEffect(() => {
    if ((state.phase !== 'bid' && state.phase !== 'play') || state.turn === 0) return
    const id = setTimeout(() => commit(chooseAction(state)), 650)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- commit closes over the same state this effect depends on
  }, [state])

  function newMatch() {
    const n = game + 1
    setGameNumber(n)
    setState(newGame(`${base}-${n}`))
    setStartedAt(Date.now())
    setReported(false)
    setResult(null)
  }

  const t = totals(state)
  const mine = state.hands[0]
  const legal = state.phase === 'play' && state.turn === 0 ? legalPlays(state) : []
  const myBid = state.phase === 'bid' && state.turn === 0
  const status = state.phase === 'bid'
    ? myBid ? 'Your bid: how many tricks will you win?' : `${NAMES[state.turn]} is bidding…`
    : state.phase === 'play'
      ? state.turn === 0 ? (state.trick.length ? 'Your turn. Follow suit; spades beat everything.' : 'You lead. Play any card.') : `${NAMES[state.turn]} is playing…`
      : ''
  const shown = state.trick.length ? state.trick : state.last?.cards ?? []

  return (
    <div className="cb">
      <div className="cb-score">
        {NAMES.map((n, p) => (
          <div key={n} className="cb-chip" data-turn={state.turn === p && (state.phase === 'bid' || state.phase === 'play') ? 'true' : undefined}>
            <strong>{n}</strong>
            <span>{state.bids[p] === null ? 'Bid –' : `Bid ${state.bids[p]}`} · Won {state.tricks[p]}</span>
            <em aria-label={`${n} total`}>{tenths(t[p])}</em>
          </div>
        ))}
      </div>
      <p className="cb-status" role="status">Round {Math.min(state.round + 1, ROUNDS)} of {ROUNDS}. {state.phase === 'over' ? '' : status}</p>

      <div className="cb-table" aria-label="Current trick">
        {[0, 1, 2, 3].map((p) => {
          const played = shown.find((x) => x.player === p)
          return (
            <div key={p} className="cb-slot" data-win={!state.trick.length && state.last?.winner === p ? 'true' : undefined}>
              <small>{NAMES[p]} · {state.hands[p].length} left</small>
              {played ? <Face card={played.card} small /> : <span className="cb-empty" />}
            </div>
          )
        })}
      </div>

      {myBid && (
        <div className="cb-bids" role="group" aria-label="Choose your bid">
          {Array.from({ length: MAX_BID - MIN_BID + 1 }, (_, i) => i + MIN_BID).map((b) => <button key={b} type="button" onClick={() => commit({ type: 'bid', bid: b })}>Bid {b}</button>)}
        </div>
      )}

      <div className="cb-hand" aria-label="Your hand">
        {mine.map((c) => {
          const ok = legal.includes(c)
          return (
            <button key={c} type="button" className="cb-card" disabled={state.phase === 'play' ? !ok : true} data-legal={ok ? 'true' : undefined} aria-label={cardName(c)} onClick={() => commit({ type: 'play', card: c })}>
              <Face card={c} />
            </button>
          )
        })}
      </div>

      {(state.phase === 'round-over' || state.phase === 'over') && (
        <div className="cb-over" role="status">
          <strong>{state.phase === 'over' ? (result?.won ? 'You win the game!' : 'Game over') : `Round ${state.round + 1} complete`}</strong>
          <table>
            <thead><tr><th /> {NAMES.map((n) => <th key={n}>{n}</th>)}</tr></thead>
            <tbody>
              {state.history.map((row, i) => <tr key={i}><th>R{i + 1}</th>{row.map((v, p) => <td key={p}>{tenths(v)}</td>)}</tr>)}
              <tr className="cb-total"><th>Total</th>{t.map((v, p) => <td key={p}>{tenths(v)}</td>)}</tr>
            </tbody>
          </table>
          {state.phase === 'over' ? <button type="button" className="primary-btn" onClick={newMatch}>New game</button> : <button type="button" className="primary-btn" onClick={() => commit({ type: 'next-round' })}>Next round</button>}
        </div>
      )}
    </div>
  )
}
