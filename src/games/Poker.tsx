import { useEffect, useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { chooseAction } from './poker/bot'
import { SUITS, START_CHIPS, applyAction, blindsFor, legalActions, newGame, potOf, rankLabel, suitOf, type Action, type State } from './poker/rules'
import { loadSession, saveSession, type Session } from './poker/save'
import './poker/poker.css'

const BOT_MS = 900
const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs']
const STREETS = { preflop: 'Pre-flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown', over: 'Finished' } as const

function Face({ id, hidden }: { id?: number; hidden?: boolean }) {
  if (hidden || id === undefined) return <span className="pk-card pk-back" aria-label="Face-down card" />
  const s = suitOf(id)
  return <span className="pk-card" data-red={s === 1 || s === 2 ? 'true' : undefined} aria-label={`${rankLabel(id)} of ${SUIT_NAMES[s]}`}><b>{rankLabel(id)}</b><i>{SUITS[s]}</i></span>
}

export function Poker({ onFinish, seed }: GameProps) {
  const [session, setSession] = useState<Session | null>(() => loadSession(seed))
  const [opponents, setOpponents] = useState(2)
  const [raise, setRaise] = useState(0)
  const latest = useRef<{ act: (a: Action) => void }>({ act: () => {} })
  const state: State | undefined = session?.state

  function start() {
    const next: Session = { state: newGame(opponents + 1, seed ?? String(createRandom()())), actions: [], startedAt: Date.now() }
    saveSession(next)
    setSession(next)
  }
  function act(action: Action) {
    if (!session) return
    const next = applyAction(session.state, action)
    if (next === session.state) return
    const updated = { ...session, state: next, actions: [...session.actions, action] }
    saveSession(updated)
    setSession(updated)
    if (next.street === 'over') {
      const won = next.winner === 0
      onFinish({
        score: won ? 1000 : Math.min(500, next.hand * 20),
        won,
        durationMs: Math.max(0, Date.now() - session.startedAt),
        stats: { opponents: next.players.length - 1, hands: next.hand, chips: next.players[0].chips },
      })
    }
  }
  useEffect(() => {
    latest.current = { act }
  })

  const betting = !!state && state.street !== 'showdown' && state.street !== 'over'
  const myTurn = betting && state!.turn === 0
  useEffect(() => {
    if (!state || !betting || state.turn === 0) return
    const timer = setTimeout(() => latest.current.act(chooseAction(state)), BOT_MS)
    return () => clearTimeout(timer)
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  const legal = state ? legalActions(state) : null
  const pot = state ? potOf(state) : 0
  const raiseTo = legal && myTurn ? Math.max(legal.min, Math.min(legal.max, raise || legal.min)) : 0
  const [sb, bb] = state ? blindsFor(state.hand) : [10, 20]
  const name = (seat: number) => (seat === 0 ? 'You' : `Computer ${seat}`)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement | null)?.closest('select, input, textarea')) return
      const k = e.key.toLowerCase()
      if (k === 'f') latest.current.act({ type: 'fold' })
      else if (k === 'c') document.querySelector<HTMLButtonElement>('.pk-call')?.click()
      else if (k === 'r') document.querySelector<HTMLButtonElement>('.pk-raise')?.click()
      else if (k === 'n') document.querySelector<HTMLButtonElement>('.pk-next')?.click()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const me = state?.players[0]
  const over = state?.street === 'over'
  const status = !state ? `Last player with chips wins. Everyone starts with ${START_CHIPS} play chips; blinds rise every 8 hands.`
    : over ? (state.winner === 0 ? `You win the tournament after ${state.hand} hands!` : me!.out ? `You are out after ${state.hand} hands.` : `${name(state.winner ?? 1)} wins the tournament.`)
      : state.street === 'showdown' ? state.wins.map((w) => `${name(w.seat)} win${w.seat === 0 ? '' : 's'} ${w.amount} (${w.label})`).join('; ') + '.'
        : myTurn ? (legal!.toCall > 0 ? `Your turn: ${legal!.toCall} to call.` : 'Your turn: check or bet.')
          : `${name(state.turn)} is thinking…`
  const won = state?.street === 'showdown' && state.wins.some((w) => w.seat === 0)

  return <div className="pk">
    {!state || over ? <div className="pk-setup">
      <label>Opponents <select value={opponents} onChange={(e) => setOpponents(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} computer{n > 1 ? 's' : ''}</option>)}</select></label>
      <button className="primary-btn" onClick={start}>{over ? 'Play again' : 'Start tournament'}</button>
    </div> : null}
    <div className="pk-table">
      <ul className="pk-seats" aria-label="Players at the table">
        {state ? state.players.slice(1).map((p, i) => { const seat = i + 1; return <li key={seat} data-turn={betting && state.turn === seat ? 'true' : undefined} data-out={p.out ? 'true' : undefined} data-folded={p.folded && !p.out ? 'true' : undefined}>
          <span className="pk-name">{state.button === seat ? <i className="pk-dealer" title="Dealer">D</i> : null}Computer {seat}</span>
          <span className="pk-chips">{p.out ? 'Out' : p.chips}</span>
          <small>{p.out ? '' : p.folded ? 'Folded' : p.allIn ? 'All-in' : p.bet ? `Bet ${p.bet}` : ''}</small>
          {p.shown ? <span className="pk-mini">{p.hole.map((id) => <Face key={id} id={id} />)}</span> : null}
        </li> }) : <li className="pk-hint">Opponents appear here.</li>}
      </ul>
      <div className="pk-board" aria-label="Board">
        <div className="pk-cards">{Array.from({ length: 5 }, (_, i) => state?.board[i] !== undefined ? <Face key={i} id={state.board[i]} /> : <span key={i} className="pk-slot" />)}</div>
        <p className="pk-pot">Pot <b>{pot}</b> · {state ? STREETS[state.street] : 'Texas Hold’em'} · Blinds {sb}/{bb}</p>
      </div>
      <p className={`pk-status${over ? (state!.winner === 0 ? ' win-message' : ' game-over') : won ? ' win-message' : ''}`} role="status" aria-live="polite">{status}</p>
      <div className="pk-me" data-turn={myTurn ? 'true' : undefined}>
        <div className="pk-cards" aria-label="Your cards">{me?.hole.length ? me.hole.map((id) => <Face key={id} id={id} />) : <><span className="pk-slot" /><span className="pk-slot" /></>}</div>
        <div className="pk-mine"><b>{state && state.button === 0 ? <i className="pk-dealer" title="Dealer">D</i> : null}You</b><span>{state ? (me!.out ? 'Out' : `${me!.chips} chips`) : `${START_CHIPS} chips`}</span><small>{me?.folded && !me.out ? 'Folded' : me?.allIn ? 'All-in' : me?.bet ? `Bet ${me.bet}` : ''}</small></div>
      </div>
    </div>
    {state && betting ? <div className="pk-actions" role="toolbar" aria-label="Your move">
      <button className="secondary-btn" onClick={() => act({ type: 'fold' })} disabled={!myTurn}>Fold</button>
      {legal!.check || !myTurn ? <button className="primary-btn pk-call" onClick={() => act({ type: 'check' })} disabled={!myTurn || !legal!.check}>Check</button>
        : <button className="primary-btn pk-call" onClick={() => act({ type: 'call' })} disabled={!myTurn}>{legal!.toCall >= me!.chips ? `All-in ${me!.chips}` : `Call ${legal!.toCall}`}</button>}
      <button className="primary-btn pk-raise" onClick={() => act({ type: 'raise', to: raiseTo })} disabled={!myTurn || !legal!.raise}>{raiseTo && raiseTo >= legal!.max ? `All-in ${raiseTo}` : `Raise to ${raiseTo || ''}`}</button>
    </div> : null}
    {state && myTurn && legal!.raise ? <div className="pk-sizes">
      <button className="secondary-btn" onClick={() => setRaise(legal!.min)}>Min</button>
      <button className="secondary-btn" onClick={() => setRaise(Math.round((state.currentBet + pot / 2) / sb) * sb)}>½ pot</button>
      <button className="secondary-btn" onClick={() => setRaise(Math.round((state.currentBet + pot) / sb) * sb)}>Pot</button>
      <button className="secondary-btn" onClick={() => setRaise(legal!.max)}>All-in</button>
      <input type="range" aria-label="Raise amount" min={legal!.min} max={legal!.max} step={Math.max(1, sb)} value={raiseTo} onChange={(e) => setRaise(Number(e.target.value))} />
    </div> : null}
    {state?.street === 'showdown' ? <div className="pk-actions"><button className="primary-btn pk-next" onClick={() => act({ type: 'next' })}>{state.players.some((p, i) => i === 0 && p.chips === 0) || state.players.filter((p) => p.chips > 0).length <= 1 ? 'See result' : 'Next hand'}</button></div> : null}
    <details className="pk-how"><summary>How to play</summary>
      <p>Texas Hold’em tournament: each player gets two private cards, five shared cards come out in three stages (flop, turn, river) and the best five-card hand wins the pot. On your turn fold, check or call, or raise. Blinds are forced bets that rise every 8 hands. Lose all your chips and you are out; the last player with chips wins. Chips are play money with no value and nothing can be bought or won. Side pots are handled when someone is all-in. Keys: F fold, C check/call, R raise, N next hand.</p>
    </details>
  </div>
}
