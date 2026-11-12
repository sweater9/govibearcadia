import { useEffect, useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import { blackjackStake, saveBankroll } from '../lib/db'
import { BLACKJACK_TABLES, DEFAULT_BLACKJACK_TABLE, blackjackTable, unlocked } from '../lib/tables'
import type { GameProps } from '../types'
import { START_CHIPS, SUITS, applyAction, basicStrategy, canDouble, canSplit, handValue, isBlackjack, maxBetFor, rankLabel, rankOf, suitOf, validBet, type Action, type Hand, type State, newGame } from './blackjack/rules'
import { loadSession, saveSession, type Session } from './blackjack/save'
import './blackjack/blackjack.css'

const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs']
const HINT: Record<string, string> = { hit: 'Hit', stand: 'Stand', double: 'Double', split: 'Split' }

function Face({ id, hidden, i = 0, flip }: { id?: number; hidden?: boolean; i?: number; flip?: boolean }) {
  if (hidden || id === undefined) return <span className="bj-card bj-hole" aria-label="Face-down card" />
  const r = rankOf(id % 52)
  const s = suitOf(id)
  return <span className="bj-card" style={{ '--i': i } as React.CSSProperties} data-flip={flip ? 'true' : undefined} data-s={SUITS[s]} data-r={rankLabel(r)} data-red={s === 1 || s === 2 ? 'true' : undefined} aria-label={`${rankLabel(r)} of ${SUIT_NAMES[s]}`}><b>{rankLabel(r)}</b><i>{SUITS[s]}</i></span>
}
const total = (cards: number[]) => { const v = handValue(cards); return v.total > 21 ? `${v.total} bust` : isBlackjack(cards) ? 'Blackjack' : `${v.soft ? 'soft ' : ''}${v.total}` }
const RESULT = { win: 'Win', lose: 'Lose', push: 'Push', blackjack: 'Blackjack!' } as const

export function Blackjack({ onFinish, seed }: GameProps) {
  const [session, setSession] = useState<Session | null>(() => loadSession(seed))
  const [bet, setBet] = useState(50)
  const [bank, setBank] = useState<number | null>(null)
  const [pick, setPick] = useState<string | null>(null)
  const [hint, setHint] = useState('')
  const latest = useRef<{ act: (a: Action) => void }>({ act: () => {} })
  const state: State | undefined = session?.state

  const sessionOver = session?.state.phase === 'over'
  useEffect(() => {
    void blackjackStake().then(setBank).catch(() => setBank(START_CHIPS))
  }, [sessionOver])
  const stakeNow = bank ?? START_CHIPS
  const chosen = blackjackTable(pick && unlocked(blackjackTable(pick), stakeNow) ? pick : unlocked(blackjackTable(DEFAULT_BLACKJACK_TABLE), stakeNow) ? DEFAULT_BLACKJACK_TABLE : 'rookie')
  async function start() {
    const stake = await blackjackStake().catch(() => START_CHIPS)
    const table = unlocked(chosen, stake) ? chosen : blackjackTable('rookie')
    const next: Session = { state: newGame(seed ?? String(createRandom()())), actions: [], startedAt: Date.now() }
    next.state = newGame(next.state.seed, stake, table.id)
    saveSession(next)
    setSession(next)
    setBet(table.chips[1])
    setHint('')
  }
  function act(action: Action) {
    if (!session) return
    const next = applyAction(session.state, action)
    if (next === session.state) return
    const updated = { ...session, state: next, actions: [...session.actions, action] }
    saveSession(updated)
    setSession(updated)
    setHint('')
    if (next.phase === 'over') {
      void saveBankroll(next.chips)
      onFinish({
        score: next.chips,
        won: next.chips > next.startChips,
        durationMs: Math.max(0, Date.now() - session.startedAt),
        stats: { rounds: next.rounds, chips: next.chips, peak: next.peak, blackjacks: next.blackjacks },
      })
    }
  }
  useEffect(() => {
    latest.current = { act }
  })

  const phase = state?.phase
  const betting = phase === 'bet' || phase === 'settled'
  const playing = phase === 'play'
  const chips = state?.chips ?? START_CHIPS
  const tb = blackjackTable(state?.table ?? chosen.id)
  const wager = Math.min(bet, maxBetFor(chips, tb.max))
  const hands: Hand[] = state?.hands ?? []
  const addChip = (n: number) => setBet((b) => Math.min(maxBetFor(chips, tb.max), b + n))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement | null)?.closest('select, input, textarea')) return
      const k = e.key.toLowerCase()
      const map: Record<string, Action['type']> = { h: 'hit', s: 'stand', d: 'double', p: 'split' }
      if (map[k]) latest.current.act({ type: map[k] } as Action)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const net = state && phase !== 'play' && state.hands.length ? state.hands.reduce((sum, h) => sum + (h.payout ?? 0) - h.bet * (h.doubled ? 2 : 1), 0) : 0
  const status = !state ? 'Beat the dealer to 21 without going over. Your bankroll carries over: cash out to keep your chips for next time.'
    : phase === 'over' ? `${state.message} You finish with ${state.chips} chips after ${state.rounds} hand${state.rounds === 1 ? '' : 's'}.`
      : playing ? (hands.length > 1 ? `Hand ${state.active + 1} of ${hands.length}: hit, stand, double or split.` : 'Hit, stand, double or split.')
        : phase === 'settled' ? `${state.message} Change your bet or deal again.` : 'Place your bet.'
  const showHole = phase !== 'play'

  return <div className="bj">
    <div className="bj-stats" aria-label="Chips">
      <span>Chips <b>{chips}</b></span>
      <span>Hand <b>{state?.rounds !== undefined ? state.rounds + (playing ? 1 : 0) : 0}</b></span>
      <span>Best <b>{state?.peak ?? START_CHIPS}</b></span>
      <span>Started with <b>{state?.startChips ?? START_CHIPS}</b></span>
    </div>
    <div className="bj-table">
      <section className="bj-seat" aria-label="Dealer">
        <h3>Dealer{state?.dealer.length ? <small>{showHole ? total(state.dealer) : `showing ${Math.min(10, rankOf(state.dealer[0] % 52))}`}</small> : null}</h3>
        <div className="bj-cards">{state?.dealer.length ? state.dealer.map((id, i) => <Face key={`${i}-${showHole}`} id={id} i={i} flip={showHole && i === 1} hidden={!showHole && i === 1} />) : <span className="bj-empty" />}</div>
      </section>
      <p className={`bj-status${phase === 'over' ? (state!.chips > state!.startChips ? ' win-message' : ' game-over') : phase === 'settled' && net > 0 ? ' win-message' : ''}`} role="status" aria-live="polite">{status}</p>
      <section className="bj-seat" aria-label="Your hands">
        <div className="bj-hands">
          {hands.length ? hands.map((h, i) => <div key={i} className="bj-hand" data-active={playing && i === state!.active ? 'true' : undefined} data-result={h.result}>
            <h3>{hands.length > 1 ? `Hand ${i + 1}` : 'You'}<small>{total(h.cards)} · bet {h.bet * (h.doubled ? 2 : 1)}{h.result ? ` · ${RESULT[h.result]}` : ''}</small></h3>
            <div className="bj-stake" aria-hidden="true">{Array.from({ length: Math.min(5, Math.ceil((h.bet * (h.doubled ? 2 : 1)) / 50)) }, (_, k) => <i key={k} data-c={k % 3} style={{ '--k': k } as React.CSSProperties} />)}</div>
            <div className="bj-cards">{h.cards.map((id, j) => <Face key={j} id={id} i={j} />)}</div>
          </div>) : <div className="bj-hand"><h3>You</h3><div className="bj-cards"><span className="bj-empty" /></div></div>}
        </div>
      </section>
    </div>
    {playing ? <div className="bj-actions" role="toolbar" aria-label="Hand actions">
      <button className="primary-btn" onClick={() => act({ type: 'hit' })}>Hit</button>
      <button className="primary-btn" onClick={() => act({ type: 'stand' })}>Stand</button>
      <button className="secondary-btn" onClick={() => act({ type: 'double' })} disabled={!canDouble(state!)}>Double</button>
      <button className="secondary-btn" onClick={() => act({ type: 'split' })} disabled={!canSplit(state!)}>Split</button>
      <button className="secondary-btn" onClick={() => setHint(`Basic strategy says: ${HINT[basicStrategy(state!)]}.`)}>Hint</button>
    </div> : null}
    {betting || !state ? <div className="bj-bet">
      <div className="bj-chips" role="group" aria-label="Add chips to your bet">
        {tb.chips.map((n) => <button key={n} type="button" className="bj-chip" data-v={n} onClick={() => addChip(n)} disabled={!state || wager + n > maxBetFor(chips, tb.max)} aria-label={`Add ${n}`}>{n}</button>)}
      </div>
      <div className="bj-bet-row">
        <span>Bet <b>{state ? wager : 0}</b></span>
        <button className="secondary-btn" onClick={() => setBet(tb.min)} disabled={!state}>Clear</button>
        {state ? <button className="primary-btn" onClick={() => act({ type: 'bet', amount: wager })} disabled={!validBet(wager, chips, tb)}>Deal</button> : <button className="primary-btn" onClick={() => void start()}>Start session</button>}
        {state ? <button className="secondary-btn" onClick={() => act({ type: 'cashout' })}>Cash out</button> : null}
      </div>
    </div> : null}
    {!state || phase === 'over' ? <div className="bj-tables" role="radiogroup" aria-label="Table">
      {BLACKJACK_TABLES.map((t) => {
        const open = unlocked(t, stakeNow)
        return <button key={t.id} type="button" role="radio" aria-checked={chosen.id === t.id} disabled={!open} className="bj-table-pick" onClick={() => setPick(t.id)}>
          <b>{t.name}</b><small>{open ? `Bets ${t.min} to ${t.max}` : `Needs ${t.needs} chips`}</small>
        </button>
      })}
    </div> : null}
    {phase === 'over' ? <div className="bj-bet"><div className="bj-bet-row"><button className="primary-btn" onClick={() => void start()}>New session</button></div></div> : null}
    {hint ? <p className="bj-hint" aria-live="polite">{hint}</p> : null}
    <details className="bj-how"><summary>How to play</summary>
      <p>Get closer to 21 than the dealer without going over. Number cards count their value, J Q K are 10, an ace is 1 or 11. The dealer stands on every 17. Blackjack (an ace and a ten-card) pays 3 to 2; other wins pay 1 to 1; a tie is a push. You can double down on your first two cards (one card, double bet) and split a pair once (split aces get one card each). Bets depend on the table: Rookie 10 to 100, Regular 10 to 500 (needs 500 chips), High roller 100 to 2,500 (needs 5,000 chips), in steps of 5. Chips are not money and have no value: this is only for fun. Keys: H hit, S stand, D double, P split.</p>
    </details>
  </div>
}
