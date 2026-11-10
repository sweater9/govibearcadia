import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { BOARD, CELLS, CENTRE_COST, GRID, GROUP_COLOURS, isClaimable, type Space } from './worldtrip/board'
import { actor, chooseAction } from './worldtrip/bot'
import { LandmarkArt } from './worldtrip/Landmark'
import { activePlayer, ALLOWANCE, applyAction, canBuildCentre, DEFAULT_TURNS, feeFor, money, newGame, standings, START_CASH, TURN_CHOICES, type Action, type State } from './worldtrip/rules'
import { loadMatch, saveMatch } from './worldtrip/save'
import './worldtrip/worldtrip.css'

const COMPUTER_DELAY_MS = 800
const PLAYER_COLOURS = ['#b4542c', '#2f6f9f', '#2f6b45', '#7a4fa0']
const CODES: Record<string, string> = {
  Vancouver: 'VAN', Toronto: 'TOR', 'Mexico City': 'MEX', 'New York': 'NYC', 'San Francisco': 'SFO', Lisbon: 'LIS', Barcelona: 'BCN', Rome: 'ROM',
  Amsterdam: 'AMS', Paris: 'PAR', London: 'LON', Stockholm: 'STO', Copenhagen: 'CPH', Oslo: 'OSL', 'Cape Town': 'CPT', Nairobi: 'NBO', Dubai: 'DXB',
  Mumbai: 'BOM', Singapore: 'SIN', Bangkok: 'BKK', Tokyo: 'TYO', Sydney: 'SYD',
}
const code = (s: Space) => (s.kind === 'city' ? CODES[s.name] : s.kind === 'airport' ? '✈' : s.kind === 'service' ? '⇄' : s.kind === 'card' ? '?' : s.kind === 'fee' ? '$' : { 'Departure Gate': 'GATE', 'Hotel Stopover': 'STAY', 'World Festival': 'FEST', 'Scenic Stopover': 'VIEW' }[s.name] ?? '')

function Die({ n }: { n: number }) {
  return <span className="wt-die" data-n={n} aria-hidden="true">{Array.from({ length: n }, (_, i) => <i key={i} />)}</span>
}

function Board({ state, selected, onSelect, status, name }: { state: State; selected: number; onSelect: (i: number) => void; status: string; name: (i: number) => string }) {
  const current = activePlayer(state)
  return <ol className="wt-board" aria-label="Board in travel order">
    {BOARD.map((space, i) => {
      const [row, col] = CELLS[i]
      const holding = state.holdings[i]
      const here = state.players.flatMap((p, pi) => (p.position === i ? [pi] : []))
      return <li key={i} style={{ gridRow: row + 1, gridColumn: col + 1, display: 'contents' }}>
        <button type="button" className="wt-cell" style={{ gridRow: row + 1, gridColumn: col + 1 }} aria-pressed={selected === i}
          aria-label={`Space ${i + 1}, ${space.name}${holding ? `, owned by ${name(holding.owner)}${holding.centre ? ' with a visitor centre' : ''}` : ''}${here.length ? `, ${here.map(name).join(' and ')} here` : ''}`}
          onClick={() => onSelect(i)}>
          {space.kind === 'city' ? <span className="wt-band" style={{ background: GROUP_COLOURS[space.group] }} /> : <span className="wt-band" style={{ background: 'transparent' }} />}
          {space.kind === 'city' ? <LandmarkArt kind={space.landmark} decorative /> : null}
          <span className={space.kind === 'airport' || space.kind === 'service' || space.kind === 'card' || space.kind === 'fee' ? 'wt-icon' : 'wt-code'}>{code(space)}</span>
          {holding ? <span className="wt-owner" style={{ background: PLAYER_COLOURS[holding.owner] }}>{holding.centre ? '◆' : ''}{holding.owner + 1}</span> : <span className="wt-owner" />}
          {here.length ? <span className="wt-tokens">{here.map((pi) => <span key={pi} className="wt-token" style={{ background: PLAYER_COLOURS[pi], outline: pi === current ? '2px solid var(--text)' : 'none' }}>{pi + 1}</span>)}</span> : null}
        </button>
      </li>
    })}
    <li style={{ display: 'contents' }}>
      <div className="wt-centre" style={{ gridArea: `2 / 2 / ${GRID} / ${GRID}` }}>
        <svg className="wt-compass" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="50" cy="50" r="32" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" /><path d="M50 8 L56 50 L50 92 L44 50 Z M8 50 L50 44 L92 50 L50 56 Z" fill="currentColor" opacity=".55" /></svg>
        <span className="wt-mark">World Trip</span>
        {state.phase === 'done' ? <strong>Trip over</strong> : <strong className="wt-turn"><span className="wt-token" style={{ background: PLAYER_COLOURS[current] }}>{current + 1}</span>{name(current)}</strong>}
        {state.dice && state.phase !== 'done' ? <div className="wt-dice" aria-label={`Rolled ${state.dice[0]} and ${state.dice[1]}`}><Die n={state.dice[0]} /><Die n={state.dice[1]} /></div> : null}
        <p role="status" className="wt-status">{status}</p>
      </div>
    </li>
  </ol>
}

function StopCard({ state, index, name }: { state: State; index: number; name: (i: number) => string }) {
  const space = BOARD[index]
  const holding = state.holdings[index]
  return <section className="wt-card" aria-label="Selected stop" style={{ '--group': space.kind === 'city' ? GROUP_COLOURS[space.group] : '#b8780f' } as React.CSSProperties}>
    {space.kind === 'city' ? <LandmarkArt kind={space.landmark} city={space.name} /> : <div className="wt-art wt-art-tile" aria-hidden="true">{code(space)}</div>}
    <div>
      <h3>{space.name}</h3>
      <p>Space {index + 1} of {BOARD.length}{space.kind === 'city' ? ` · ${space.country}` : ''}</p>
      {isClaimable(space) ? <p>{holding ? `Owned by ${name(holding.owner)}` : `For sale ${money(space.price)}`} · visitor fee {money(feeFor(space, !!holding?.centre))}{holding?.centre ? ' (visitor centre)' : ''}</p> : null}
      {space.kind === 'fee' ? <p>Flat fee {money(space.amount)}</p> : null}
      {space.kind === 'card' ? <p>Draw a Travel Card with an immediate effect.</p> : null}
      {space.kind === 'corner' ? <p>{space.name === 'Departure Gate' ? `Collect ${money(ALLOWANCE)} each lap.` : 'A free stop.'}</p> : null}
    </div>
  </section>
}

function Manage({ state, act, name }: { state: State; act: (a: Action) => void; name: (i: number) => string }) {
  const index = activePlayer(state)
  const owned = state.holdings.flatMap((h, i) => (h?.owner === index ? [i] : []))
  const [error, setError] = useState('')
  const propose = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const f = new FormData(event.currentTarget)
    const offer = { space: Number(f.get('space')), buyer: Number(f.get('buyer')), price: Number(f.get('price')) }
    if (offer.price > state.players[offer.buyer].cash) { setError('That buyer does not have enough credits.'); return }
    setError('')
    act({ type: 'offer', offer })
  }
  if (state.offer) {
    const { buyer, space, price } = state.offer
    return <section aria-label="Pending offer">
      <p role="status">Pass the device to {name(buyer)}. Buy {BOARD[space].name} from {name(index)} for {money(price)}?</p>
      <div className="wt-actions"><button className="primary-btn" onClick={() => act({ type: 'accept' })}>Accept offer</button><button className="secondary-btn" onClick={() => act({ type: 'decline' })}>Decline offer</button></div>
    </section>
  }
  return <>
    <div className="wt-actions"><button className="primary-btn" onClick={() => act({ type: 'end' })}>End turn</button></div>
    {owned.length ? <details>
      <summary>Deals and visitor centres</summary>
      <ul className="wt-props">{owned.map((i) => {
        const space = BOARD[i]
        const h = state.holdings[i]!
        return <li key={i}>{space.name}{space.kind === 'city' ? (h.centre ? <span>Visitor centre built</span> :
          <button className="secondary-btn" disabled={!canBuildCentre(state, index, i)} title="Needs every city in the colour group" onClick={() => act({ type: 'upgrade', space: i })}>Build centre · {money(CENTRE_COST[space.group])}</button>) : null}</li>
      })}</ul>
      {!state.traded ? <form className="wt-form" onSubmit={propose}>
        <label>Stop <select name="space">{owned.map((i) => <option key={i} value={i}>{BOARD[i].name}</option>)}</select></label>
        <label>Buyer <select name="buyer">{state.players.map((_, i) => (i === index ? null : <option key={i} value={i}>{name(i)}</option>))}</select></label>
        <label>Price (cr) <input name="price" type="number" min="1" step="1" required /></label>
        <button className="secondary-btn">Offer sale</button>
        {error ? <p role="alert">{error}</p> : null}
      </form> : <p>Offer used for this turn.</p>}
    </details> : null}
  </>
}

export function WorldTrip({ onFinish, seed }: GameProps) {
  const [match, setMatch] = useState(() => loadMatch(seed))
  const [count, setCount] = useState(2)
  const [computersWanted, setComputersWanted] = useState(1)
  const [turnsEach, setTurnsEach] = useState<number>(DEFAULT_TURNS)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const state = match?.state

  function start() {
    const next = { state: newGame(count, seed ?? String(createRandom()()), turnsEach), actions: [], startedAt: Date.now(), computers: Math.min(computersWanted, count - 1) }
    saveMatch(next)
    setMatch(next)
    setConfirmRestart(false)
    setPicked(null)
  }
  function act(action: Action) {
    if (!match) return
    const next = applyAction(match.state, action)
    if (next === match.state) return
    const updated = { ...match, state: next, actions: [...match.actions, action] }
    saveMatch(updated)
    setMatch(updated)
    setPicked(null)
    if (next.phase === 'done') {
      const ranking = standings(next)
      onFinish({ score: ranking[0].worth, won: true, durationMs: Math.max(0, Date.now() - match.startedAt), stats: { players: next.players.length, turns: next.turn, turnsEach: next.turnsEach } })
    }
  }

  const computers = match?.computers ?? 0
  const humans = (state?.players.length ?? count) - computers
  const isComputer = (i: number) => i >= humans
  const name = (i: number) => (isComputer(i) ? `Computer ${i - humans + 1}` : `Player ${i + 1}`)
  const relabel = (text: string) =>
    text.replace(/Pass the device to Player 1\./, humans === 1 ? 'Your turn.' : 'Pass the device to Player 1.').replace(/Pass the device to Player (\d)\./g, (m, n) => (isComputer(Number(n) - 1) ? '' : m)).replace(/Player (\d)/g, (m, n) => (isComputer(Number(n) - 1) ? name(Number(n) - 1) : m)).trim()
  const current = state ? activePlayer(state) : 0
  const waiting = !!state && state.phase !== 'done' && isComputer(actor(state))
  const latest = useRef<{ act: (a: Action) => void }>({ act: () => {} })
  useEffect(() => {
    latest.current = { act }
  })
  // The computer moves on a short timer so the player can follow what happened. One timer per position.
  useEffect(() => {
    if (!state || state.phase === 'done' || confirmRestart || !isComputer(actor(state))) return
    const timer = setTimeout(() => latest.current.act(chooseAction(state)), COMPUTER_DELAY_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, confirmRestart])
  const ranking = state ? standings(state) : []
  const leaders = ranking.filter((e) => e.worth === ranking[0]?.worth)
  const viewIndex = picked ?? (state ? state.players[current].position : 0)
  const landed = state ? BOARD[state.players[current].position] : null
  const view = state ?? newGame(count, '', turnsEach)
  const statusText = !state ? `Everyone starts at the Departure Gate with ${money(START_CASH)}.` : state.phase === 'done'
    ? `${leaders.map(({ index }) => name(index)).join(' and ')} ${leaders.length > 1 ? 'share the win' : 'wins'} with ${money(leaders[0].worth)}.`
    : `Round ${Math.floor(state.turn / state.players.length) + 1} of ${state.turnsEach} · ${name(current)}. ${state.dice ? `Rolled ${state.dice.join(' + ')}. ` : ''}${relabel(state.message)}`

  return <div className="wt">
    {!state || state.phase === 'done' || confirmRestart ? <div className="wt-setup">
      <label>Players <select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[2, 3, 4].map((n) => <option key={n} value={n}>{n} players</option>)}</select></label>
      <label>Computer players <select value={Math.min(computersWanted, count - 1)} onChange={(e) => setComputersWanted(Number(e.target.value))}>{Array.from({ length: count }, (_, n) => <option key={n} value={n}>{n === 0 ? 'None (pass the device)' : n}</option>)}</select></label>
      <label>Turns each <select value={turnsEach} onChange={(e) => setTurnsEach(Number(e.target.value))}>{TURN_CHOICES.map((n) => <option key={n} value={n}>{n}{n === DEFAULT_TURNS ? ' (standard)' : ''}</option>)}</select></label>
      <button className="primary-btn" onClick={start}>{confirmRestart ? 'Replace match' : 'Start match'}</button>
      {confirmRestart ? <button className="secondary-btn" onClick={() => setConfirmRestart(false)}>Keep playing</button> : null}
    </div> : null}
    {state && state.phase !== 'done' ? <div className="wt-actions">
      {waiting ? <p className="wt-thinking" role="status">{name(actor(state))} is playing…</p> : null}
      {!waiting && state.phase === 'roll' ? <button className="primary-btn" onClick={() => act({ type: 'roll' })}>Roll dice</button> : null}
      {!waiting && state.phase === 'buy' && landed && isClaimable(landed) ? <>
        <button className="primary-btn" aria-label={`Claim ${landed.name} for ${money(landed.price)}`} onClick={() => act({ type: 'buy' })}>Claim · {money(landed.price)}</button>
        <button className="secondary-btn" onClick={() => act({ type: 'skip' })}>Pass</button>
      </> : null}
    </div> : null}
    <div className="wt-layout">
      <Board state={view} selected={viewIndex} onSelect={setPicked} status={statusText} name={name} />
      <div className="wt-side">
        <StopCard state={view} index={viewIndex} name={name} />
        {state && state.phase === 'manage' && !waiting ? <Manage key={state.turn} state={state} act={act} name={name} /> : null}
        {state ? <ul className="wt-balances" aria-label={state.phase === 'done' ? 'Final standings' : 'Player balances'}>
          {(state.phase === 'done' ? ranking : [...ranking].sort((a, b) => a.index - b.index)).map(({ index, cash, worth }) => <li key={index} data-active={state.phase !== 'done' && index === current ? 'true' : undefined}>
            <span className="wt-token" style={{ background: PLAYER_COLOURS[index] }}>{index + 1}</span>
            <span className="wt-bal"><strong>{name(index)}</strong><b>{money(worth)} net worth</b><small>{money(cash)} credits{state.phase === 'done' ? ` · cities: ${state.collected[index].map((s) => BOARD[s].name).join(', ') || 'none'}` : ''}</small></span>
          </li>)}
        </ul> : null}
        {state && state.phase !== 'done' && !confirmRestart ? <button className="secondary-btn" onClick={() => setConfirmRestart(true)}>New match</button> : null}
      </div>
    </div>
    <details><summary>How to play</summary>
      <p>Roll two dice and travel clockwise round the 40 spaces. Passing or landing on the Departure Gate earns {money(ALLOWANCE)}. Claim an unowned city, airport or travel service when you land, or pass. Landing on another player’s stop costs its visitor fee.</p>
      <p>Own every city in a colour group to build visitor centres, which double a city’s fee. Draw Travel Cards for quick events, and pay the flat fees. Offer one stop for sale each turn; pass the device to the buyer to accept or decline. If you run short, you pay what you have and stay in the match.</p>
      <p>After {state?.turnsEach ?? turnsEach} turns each, the highest net worth wins: credits plus the printed value of your stops and visitor centres. Ties share the win. Select any space on the board to see its details.</p>
    </details>
  </div>
}
