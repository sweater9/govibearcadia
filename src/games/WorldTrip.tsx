import { useState, type FormEvent } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { BOARD, CELLS, CENTRE_COST, GRID, GROUP_COLOURS, isClaimable, type Space } from './worldtrip/board'
import { LandmarkArt } from './worldtrip/Landmark'
import { activePlayer, ALLOWANCE, applyAction, canBuildCentre, DEFAULT_TURNS, feeFor, money, newGame, playerName, standings, START_CASH, TURN_CHOICES, type Action, type State } from './worldtrip/rules'
import { loadMatch, saveMatch } from './worldtrip/save'
import './worldtrip/worldtrip.css'

const PLAYER_COLOURS = ['#b4542c', '#2f6f9f', '#2f6b45', '#7a4fa0']
const CODES: Record<string, string> = {
  Vancouver: 'VAN', Toronto: 'TOR', 'Mexico City': 'MEX', 'New York': 'NYC', 'San Francisco': 'SFO', Lisbon: 'LIS', Barcelona: 'BCN', Rome: 'ROM',
  Amsterdam: 'AMS', Paris: 'PAR', London: 'LON', Stockholm: 'STO', Copenhagen: 'CPH', Oslo: 'OSL', 'Cape Town': 'CPT', Nairobi: 'NBO', Dubai: 'DXB',
  Mumbai: 'BOM', Singapore: 'SIN', Bangkok: 'BKK', Tokyo: 'TYO', Sydney: 'SYD',
}
const code = (s: Space) => (s.kind === 'city' ? CODES[s.name] : s.kind === 'airport' ? '✈' : s.kind === 'service' ? '⇄' : s.kind === 'card' ? '?' : s.kind === 'fee' ? '$' : { 'Departure Gate': 'GATE', 'Hotel Stopover': 'STAY', 'World Festival': 'FEST', 'Scenic Stopover': 'VIEW' }[s.name] ?? '')

function Board({ state, selected, onSelect, status }: { state: State; selected: number; onSelect: (i: number) => void; status: string }) {
  const current = activePlayer(state)
  return <ol className="wt-board" aria-label="Board in travel order">
    {BOARD.map((space, i) => {
      const [row, col] = CELLS[i]
      const holding = state.holdings[i]
      const here = state.players.flatMap((p, pi) => (p.position === i ? [pi] : []))
      return <li key={i} style={{ gridRow: row + 1, gridColumn: col + 1, display: 'contents' }}>
        <button type="button" className="wt-cell" style={{ gridRow: row + 1, gridColumn: col + 1 }} aria-pressed={selected === i}
          aria-label={`Space ${i + 1}, ${space.name}${holding ? `, owned by ${playerName(holding.owner)}${holding.centre ? ' with a visitor centre' : ''}` : ''}${here.length ? `, ${here.map(playerName).join(' and ')} here` : ''}`}
          onClick={() => onSelect(i)}>
          {space.kind === 'city' ? <span className="wt-band" style={{ background: GROUP_COLOURS[space.group] }} /> : <span className="wt-band" style={{ background: 'transparent' }} />}
          <span className={space.kind === 'airport' || space.kind === 'service' || space.kind === 'card' || space.kind === 'fee' ? 'wt-icon' : 'wt-code'}>{code(space)}</span>
          {holding ? <span className="wt-owner" style={{ background: PLAYER_COLOURS[holding.owner] }}>{holding.centre ? '◆' : ''}{holding.owner + 1}</span> : <span className="wt-owner" />}
          {here.length ? <span className="wt-tokens">{here.map((pi) => <span key={pi} className="wt-token" style={{ background: PLAYER_COLOURS[pi], outline: pi === current ? '2px solid var(--text)' : 'none' }}>{pi + 1}</span>)}</span> : null}
        </button>
      </li>
    })}
    <li style={{ display: 'contents' }}>
      <div className="wt-centre" style={{ gridArea: `2 / 2 / ${GRID} / ${GRID}` }}>
        {state.phase === 'done' ? <strong>Trip over</strong> : <strong>{playerName(current)}</strong>}
        {state.dice && state.phase !== 'done' ? <div className="wt-dice" aria-label={`Rolled ${state.dice[0]} and ${state.dice[1]}`}><span className="wt-die">{state.dice[0]}</span><span className="wt-die">{state.dice[1]}</span></div> : null}
        <p role="status" className="wt-status">{status}</p>
      </div>
    </li>
  </ol>
}

function StopCard({ state, index }: { state: State; index: number }) {
  const space = BOARD[index]
  const holding = state.holdings[index]
  return <section className="wt-card" aria-label="Selected stop">
    {space.kind === 'city' ? <LandmarkArt kind={space.landmark} city={space.name} /> : <div className="wt-art" aria-hidden="true" style={{ aspectRatio: '80/48', display: 'grid', placeItems: 'center', fontSize: '2rem' }}>{code(space)}</div>}
    <div>
      <h3>{space.name}</h3>
      <p>Space {index + 1} of {BOARD.length}{space.kind === 'city' ? ` · ${space.country}` : ''}</p>
      {isClaimable(space) ? <p>{holding ? `Owned by ${playerName(holding.owner)}` : `For sale ${money(space.price)}`} · visitor fee {money(feeFor(space, !!holding?.centre))}{holding?.centre ? ' (visitor centre)' : ''}</p> : null}
      {space.kind === 'fee' ? <p>Flat fee {money(space.amount)}</p> : null}
      {space.kind === 'card' ? <p>Draw a Travel Card with an immediate effect.</p> : null}
      {space.kind === 'corner' ? <p>{space.name === 'Departure Gate' ? `Collect ${money(ALLOWANCE)} each lap.` : 'A free stop.'}</p> : null}
    </div>
  </section>
}

function Manage({ state, act }: { state: State; act: (a: Action) => void }) {
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
      <p role="status">Pass the device to {playerName(buyer)}. Buy {BOARD[space].name} from {playerName(index)} for {money(price)}?</p>
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
        <label>Buyer <select name="buyer">{state.players.map((_, i) => (i === index ? null : <option key={i} value={i}>{playerName(i)}</option>))}</select></label>
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
  const [turnsEach, setTurnsEach] = useState<number>(DEFAULT_TURNS)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const state = match?.state

  function start() {
    const next = { state: newGame(count, seed ?? String(createRandom()()), turnsEach), actions: [], startedAt: Date.now() }
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

  const current = state ? activePlayer(state) : 0
  const ranking = state ? standings(state) : []
  const leaders = ranking.filter((e) => e.worth === ranking[0]?.worth)
  const viewIndex = picked ?? (state ? state.players[current].position : 0)
  const landed = state ? BOARD[state.players[current].position] : null
  const view = state ?? newGame(count, '', turnsEach)
  const statusText = !state ? `Everyone starts at the Departure Gate with ${money(START_CASH)}.` : state.phase === 'done'
    ? `${leaders.map(({ index }) => playerName(index)).join(' and ')} ${leaders.length > 1 ? 'share the win' : 'wins'} with ${money(leaders[0].worth)}.`
    : `Round ${Math.floor(state.turn / state.players.length) + 1} of ${state.turnsEach} · ${playerName(current)}. ${state.dice ? `Rolled ${state.dice.join(' + ')}. ` : ''}${state.message}`

  return <div className="wt">
    {!state || state.phase === 'done' || confirmRestart ? <div className="wt-setup">
      <label>Players <select value={count} onChange={(e) => setCount(Number(e.target.value))}>{[2, 3, 4].map((n) => <option key={n} value={n}>{n} players</option>)}</select></label>
      <label>Turns each <select value={turnsEach} onChange={(e) => setTurnsEach(Number(e.target.value))}>{TURN_CHOICES.map((n) => <option key={n} value={n}>{n}{n === DEFAULT_TURNS ? ' (standard)' : ''}</option>)}</select></label>
      <button className="primary-btn" onClick={start}>{confirmRestart ? 'Replace match' : 'Start match'}</button>
      {confirmRestart ? <button className="secondary-btn" onClick={() => setConfirmRestart(false)}>Keep playing</button> : null}
    </div> : null}
    {state && state.phase !== 'done' ? <div className="wt-actions">
      {state.phase === 'roll' ? <button className="primary-btn" onClick={() => act({ type: 'roll' })}>Roll dice</button> : null}
      {state.phase === 'buy' && landed && isClaimable(landed) ? <>
        <button className="primary-btn" aria-label={`Claim ${landed.name} for ${money(landed.price)}`} onClick={() => act({ type: 'buy' })}>Claim · {money(landed.price)}</button>
        <button className="secondary-btn" onClick={() => act({ type: 'skip' })}>Pass</button>
      </> : null}
    </div> : null}
    <div className="wt-layout">
      <Board state={view} selected={viewIndex} onSelect={setPicked} status={statusText} />
      <div className="wt-side">
        <StopCard state={view} index={viewIndex} />
        {state && state.phase === 'manage' ? <Manage key={state.turn} state={state} act={act} /> : null}
        {state ? <ul className="wt-balances" aria-label={state.phase === 'done' ? 'Final standings' : 'Player balances'}>
          {(state.phase === 'done' ? ranking : [...ranking].sort((a, b) => a.index - b.index)).map(({ index, cash, worth }) => <li key={index}>
            <span className="wt-token" style={{ background: PLAYER_COLOURS[index] }}>{index + 1}</span>
            <span><strong>{playerName(index)}</strong> · {money(cash)} credits · {money(worth)} net worth{state.phase === 'done' ? ` · cities: ${state.collected[index].map((s) => BOARD[s].name).join(', ') || 'none'}` : ''}</span>
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
