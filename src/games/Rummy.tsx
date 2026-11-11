import { useEffect, useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { chooseAction } from './rummy/bot'
import { SUITS, applyAction, bestPlan, card, newGame, cardName, declareError, meldKind, rankLabel, type Action, type State } from './rummy/rules'
import { loadMatch, saveMatch, type Match } from './rummy/save'
import './rummy/rummy.css'

const STEP_MS = 850
const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs']
const MELD_LABEL = { pure: 'Pure sequence', run: 'Sequence', set: 'Set' } as const

/** Cards in a group read left to right: runs by rank (an ace goes high next to a king), sets by suit. */
function orderGroup(ids: number[]): number[] {
  const ranks = ids.map((id) => card(id).rank)
  const aceHigh = ranks.includes(1) && ranks.includes(13) && !ranks.includes(2)
  const key = (id: number) => { const c = card(id); return c.printedJoker ? 99 : aceHigh && c.rank === 1 ? 14 : c.rank }
  return [...ids].sort((a, b) => key(a) - key(b) || card(a).suit - card(b).suit)
}
const looseOrder = (ids: number[]) => [...ids].sort((a, b) => { const x = card(a), y = card(b); return (x.printedJoker ? 9 : x.suit) - (y.printedJoker ? 9 : y.suit) || x.rank - y.rank })

function Face({ id, wild, selected, onClick, disabled, label }: { id: number; wild: number; selected?: boolean; onClick?: () => void; disabled?: boolean; label?: string }) {
  const c = card(id)
  const joker = c.printedJoker || c.rank === wild
  return <button type="button" className="rm-card" data-card={id} data-red={c.suit === 1 || c.suit === 2 ? 'true' : undefined} data-joker={joker ? 'true' : undefined} data-selected={selected ? 'true' : undefined}
    aria-pressed={onClick ? !!selected : undefined} aria-label={label ?? (c.printedJoker ? 'Joker' : `${rankLabel(c.rank)} of ${SUIT_NAMES[c.suit]}${joker ? ', wild joker' : ''}`)} disabled={disabled || !onClick} onClick={onClick}>
    <b>{c.printedJoker ? '★' : rankLabel(c.rank)}</b><span>{c.printedJoker ? 'JOKER' : SUITS[c.suit]}</span>
  </button>
}

export function Rummy({ onFinish, seed }: GameProps) {
  const [match, setMatch] = useState<Match | null>(() => loadMatch(seed))
  const [opponents, setOpponents] = useState(1)
  const [selected, setSelected] = useState<number[]>([])
  const [note, setNote] = useState('')
  const latest = useRef<{ act: (a: Action) => void }>({ act: () => {} })
  const state: State | undefined = match?.state

  function start() {
    const next: Match = { state: newGame(opponents + 1, seed ?? String(createRandom()())), actions: [], startedAt: Date.now(), layout: [] }
    saveMatch(next)
    setMatch(next)
    setSelected([])
    setNote('')
  }
  function act(action: Action, layout?: number[][]) {
    if (!match) return
    const who = match.state.turn
    const next = applyAction(match.state, action)
    if (next === match.state) return
    const updated: Match = { ...match, state: next, actions: [...match.actions, action], layout: layout ?? match.layout }
    saveMatch(updated)
    setMatch(updated)
    const name = who === 0 ? 'You' : `Computer ${who}`
    if (action.type === 'draw') setNote(`${name} drew from the ${action.from === 'stock' ? 'stock' : `discard pile (${cardName(next.hands[who][next.hands[who].length - 1])})`}.`)
    if (action.type === 'discard') setNote(`${name} discarded ${cardName(action.card)}.`)
    if (next.phase === 'done') {
      const won = next.winner === 0
      const mine = next.scores![0]
      onFinish({
        score: won ? 200 + next.scores!.slice(1).reduce((a, b) => a + b, 0) : Math.max(0, 80 - mine),
        won,
        durationMs: Math.max(0, Date.now() - match.startedAt),
        stats: { opponents: next.players - 1, turns: next.turns, points: mine, wild: next.wild },
      })
    }
  }
  useEffect(() => {
    latest.current = { act }
  })

  const human = state?.turn === 0 && state.phase !== 'done'
  useEffect(() => {
    if (!state || state.phase === 'done' || state.turn === 0) return
    const timer = setTimeout(() => latest.current.act(chooseAction(state)), STEP_MS)
    return () => clearTimeout(timer)
  }, [match]) // eslint-disable-line react-hooks/exhaustive-deps

  const hand = state?.hands[0] ?? []
  const wild = state?.wild ?? 1
  const groups = (match?.layout ?? []).map((g) => g.filter((id) => hand.includes(id))).filter((g) => g.length)
  const grouped = new Set(groups.flat())
  const loose = looseOrder(hand.filter((id) => !grouped.has(id)))
  const chosen = selected.filter((id) => hand.includes(id))

  function setLayout(next: number[][]) {
    if (!match) return
    const updated = { ...match, layout: next }
    saveMatch(updated)
    setMatch(updated)
  }
  const toggle = (id: number) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  function groupSelected() {
    if (chosen.length < 2) return
    setLayout([...groups.map((g) => g.filter((id) => !chosen.includes(id))).filter((g) => g.length), orderGroup(chosen)])
    setSelected([])
  }
  function ungroupSelected() {
    setLayout(groups.map((g) => g.filter((id) => !chosen.includes(id))).filter((g) => g.length))
    setSelected([])
  }
  function autoGroup() {
    setLayout(bestPlan(hand, wild).groups.map((g) => orderGroup(g.ids)))
    setSelected([])
  }
  const canDraw = human && state!.phase === 'draw'
  const canDiscard = human && state!.phase === 'discard' && chosen.length === 1 && chosen[0] !== state!.taken
  const declareGroups = chosen.length === 1 ? groups.map((g) => g.filter((id) => id !== chosen[0])).filter((g) => g.length) : groups
  const declareProblem = human && state!.phase === 'discard' ? (chosen.length === 1 ? declareError(hand, chosen[0], declareGroups, wild) : 'Select one card to throw away, then declare.') : 'Draw a card first.'
  function discard() {
    if (!canDiscard) return
    act({ type: 'discard', card: chosen[0] })
    setSelected([])
  }
  function declare() {
    if (!human || state!.phase !== 'discard' || declareProblem !== null) return
    act({ type: 'declare', card: chosen[0], groups: declareGroups })
    setSelected([])
  }

  const keys = useRef({ draw: (from: 'stock' | 'discard'): void => void from, group: () => {}, discard: () => {} })
  useEffect(() => {
    keys.current = { draw: (from) => canDraw && act({ type: 'draw', from }), group: groupSelected, discard }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement | null)?.closest('select, input, textarea')) return
      const k = e.key.toLowerCase()
      if (k === 's') keys.current.draw('stock')
      else if (k === 't') keys.current.draw('discard')
      else if (k === 'g') keys.current.group()
      else if (k === 'x') keys.current.discard()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const top = state?.discard[state.discard.length - 1]
  const done = state?.phase === 'done'
  const status = !state ? 'Make a pure sequence, a second sequence and sets with all 13 cards, then declare.'
    : done ? (state.winner === 0 ? `You win! Valid declaration, ${state.scores!.slice(1).reduce((a, b) => a + b, 0)} points to the others.` : state.winner! > 0 && state.message === 'Valid declaration.' ? `Computer ${state.winner} declares and wins. You score ${state.scores![0]}.` : `${state.message} You score ${state.scores![0]}.`)
    : human ? (state.phase === 'draw' ? 'Your turn: draw from the stock or take the top discard.' : 'Discard a card, or declare if your hand is complete.')
      : `Computer ${state.turn} is playing…`

  return <div className="rm">
    {!state || done ? <div className="rm-setup">
      <label>Opponents <select value={opponents} onChange={(e) => setOpponents(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n} computer{n > 1 ? 's' : ''}</option>)}</select></label>
      <button className="primary-btn" onClick={start}>{done ? 'Play again' : 'Start game'}</button>
    </div> : null}
    <div className="rm-centre">
      <div className="rm-pile">
        <button type="button" className="rm-back" disabled={!canDraw || state!.stock.length === 0} onClick={() => act({ type: 'draw', from: 'stock' })} aria-label={`Draw from the stock, ${state?.stock.length ?? 0} cards`}>
          <b>Stock</b><span>{state?.stock.length ?? 0}</span>
        </button>
        {top !== undefined ? <Face id={top} wild={wild} onClick={canDraw ? () => act({ type: 'draw', from: 'discard' }) : undefined} label={`Take the top discard, ${cardName(top)}`} /> : <span className="rm-empty">Discard</span>}
        {state ? <div className="rm-wild" aria-label={`Wild joker rank ${rankLabel(wild)}`}><small>Wild joker</small><b>{rankLabel(wild)}</b></div> : null}
      </div>
      <div className="rm-info">
      {state ? <ul className="rm-opps" aria-label="Opponents">
      {state.hands.slice(1).map((h, i) => <li key={i} data-turn={state.turn === i + 1 && !done ? 'true' : undefined}>Computer {i + 1}<small>{h.length} cards{done ? ` · ${state.scores![i + 1]} pts` : ''}</small></li>)}
    </ul> : null}
      <p className={`rm-status${done ? (state!.winner === 0 ? ' win-message' : ' game-over') : ''}`} role="status" aria-live="polite">{note && !done && human ? `${note} ` : ''}{status}</p>
      </div>
    </div>
    {state && !done ? <div className="rm-actions" role="toolbar" aria-label="Hand actions">
      <button className="secondary-btn" onClick={groupSelected} disabled={chosen.length < 2}>Group</button>
      <button className="secondary-btn" onClick={ungroupSelected} disabled={!chosen.some((id) => grouped.has(id))}>Ungroup</button>
      <button className="secondary-btn" onClick={autoGroup}>Auto-group</button>
      <button className="primary-btn" onClick={discard} disabled={!canDiscard}>Discard</button>
      <button className="primary-btn" onClick={declare} disabled={declareProblem !== null} title={declareProblem ?? 'Declare'}>Declare</button>
    </div> : null}
    <div className="rm-hand" aria-label="Your hand">
      {!state ? <p className="rm-hint">Press Start game to deal 13 cards each.</p> : null}
      {groups.map((g, i) => { const kind = meldKind(g, wild); return <div key={i} className="rm-group" data-kind={kind ?? 'none'}>
        <div className="rm-cards">{g.map((id) => <Face key={id} id={id} wild={wild} selected={chosen.includes(id)} onClick={done ? undefined : () => toggle(id)} />)}</div>
        <small>{kind ? MELD_LABEL[kind] : g.length < 3 ? 'Needs 3+' : 'Not a meld'}</small>
      </div> })}
      {loose.length ? <div className="rm-group" data-kind="loose"><div className="rm-cards">{loose.map((id) => <Face key={id} id={id} wild={wild} selected={chosen.includes(id)} onClick={done ? undefined : () => toggle(id)} />)}</div><small>Loose</small></div> : null}
    </div>
    {state && !done && human && state.phase === 'discard' && declareProblem ? <p className="rm-hint" aria-live="polite">Declare: {declareProblem}</p> : null}
    <details className="rm-how"><summary>How to play</summary>
      <p>Each player gets 13 cards. On your turn draw one card (from the stock or the top discard), then discard one. Group your cards into sequences (3 or more in a row of one suit; the ace is low or high) and sets (3 or 4 of a rank in different suits). Jokers (★ and the wild rank shown on the table) can stand in for any card.</p>
      <p>To win, declare with at least two sequences, one of them pure (no joker), and every other card in a sequence or set. The card you throw away when declaring is not counted. A rival scores their loose cards (A, K, Q, J = 10, jokers 0), capped at 80; with no pure sequence plus a second sequence every card counts. Keys: S stock, T take discard, G group, X discard.</p>
    </details>
  </div>
}
