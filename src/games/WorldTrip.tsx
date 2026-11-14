import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { BOARD, CELLS, CENTRE_COST, GRID, GROUP_COLOURS, isClaimable, type Space } from './worldtrip/board'
import { actor, chooseAction } from './worldtrip/bot'
import { PLAYER_COLOURS } from './worldtrip/colours'
import { Deed } from './worldtrip/Deed'
import { LandmarkArt } from './worldtrip/Landmark'
import { activePlayer, ALLOWANCE, applyAction, AUCTION_STEP, canBuildCentre, canMortgage, canRedeem, DEFAULT_TURNS, feeAt, HOTEL_FEE, MAX_PLAYERS, MIN_PLAYERS, money, mortgageValue, newGame, offerProblem, redeemCost, standings, START_CASH, TURN_CHOICES, type Action, type State } from './worldtrip/rules'
import { loadMatch, saveMatch } from './worldtrip/save'
import { statusFor } from './worldtrip/status'
import './worldtrip/worldtrip.css'

const COMPUTER_DELAY_MS = 800
const CODES: Record<string, string> = {
  Vancouver: 'VAN', Toronto: 'TOR', 'Mexico City': 'MEX', 'New York': 'NYC', 'San Francisco': 'SFO', Lisbon: 'LIS', Barcelona: 'BCN', Rome: 'ROM',
  Amsterdam: 'AMS', Paris: 'PAR', London: 'LON', Stockholm: 'STO', Copenhagen: 'CPH', Oslo: 'OSL', 'Cape Town': 'CPT', Nairobi: 'NBO', Dubai: 'DXB',
  Mumbai: 'BOM', Singapore: 'SIN', Bangkok: 'BKK', Tokyo: 'TYO', Sydney: 'SYD',
}
const code = (s: Space) => (s.kind === 'city' ? CODES[s.name] : s.kind === 'airport' ? '✈' : s.kind === 'service' ? '⇄' : s.kind === 'card' ? (s.deck === 'fortune' ? '★' : '?') : s.kind === 'fee' ? '$' : { 'Departure Gate': 'GATE', 'Hotel Stopover': 'STAY', 'World Festival': 'FEST', 'Scenic Stopover': 'VIEW' }[s.name] ?? '')

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
          aria-label={`Space ${i + 1}, ${space.name}${holding ? `, owned by ${name(holding.owner)}${holding.centre ? ' with a visitor centre' : ''}, visitors pay ${money(feeAt(state, i))}` : ''}${here.length ? `, ${here.map(name).join(' and ')} here` : ''}`}
          onClick={() => onSelect(i)}>
          {space.kind === 'city' ? <span className="wt-band" style={{ background: GROUP_COLOURS[space.group] }} /> : <span className="wt-band" style={{ background: 'transparent' }} />}
          {space.kind === 'city' ? <LandmarkArt kind={space.landmark} decorative /> : null}
          <span className={space.kind === 'airport' || space.kind === 'service' || space.kind === 'card' || space.kind === 'fee' ? 'wt-icon' : 'wt-code'}>{code(space)}</span>
          {holding ? <span className="wt-owner" style={{ background: PLAYER_COLOURS[holding.owner] }} title={`Owner: ${name(holding.owner)}. Visitors pay ${money(feeAt(state, i))}`}>{holding.centre ? '◆' : ''}{holding.owner + 1}<b className="wt-rent">{holding.mortgaged ? '–' : feeAt(state, i)}</b></span> : <span className="wt-owner" />}
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
  if (isClaimable(BOARD[index])) return <section className="wt-card wt-card-deed" aria-label="Selected stop"><Deed state={state} index={index} name={name} compact /></section>
  return <PlainStop state={state} index={index} name={name} />
}

function PlainStop({ state, index, name }: { state: State; index: number; name: (i: number) => string }) {
  const space = BOARD[index]
  const holding = state.holdings[index]
  return <section className="wt-card" aria-label="Selected stop" style={{ '--group': space.kind === 'city' ? GROUP_COLOURS[space.group] : '#b8780f' } as React.CSSProperties}>
    {space.kind === 'city' ? <LandmarkArt kind={space.landmark} city={space.name} /> : <div className="wt-art wt-art-tile" aria-hidden="true">{code(space)}</div>}
    <div>
      <h3>{space.name}</h3>
      <p>Space {index + 1} of {BOARD.length}{space.kind === 'city' ? ` · ${space.country}` : ''}</p>
      {isClaimable(space) ? <p>{holding ? `Owned by ${name(holding.owner)}${holding.mortgaged ? ' (mortgaged)' : ''}` : `For sale ${money(space.price)}`} · visitor fee {money(feeAt(state, index))}{holding?.centre ? ' (visitor centre)' : ''}</p> : null}
      {space.kind === 'fee' ? <p>Flat fee {money(space.amount)}</p> : null}
      {space.kind === 'card' ? <p>{space.deck === 'travel' ? 'Draw a Travel Card: a small event.' : 'Draw a Fortune Card: a bigger swing, and sometimes the Hotel Stopover.'}</p> : null}
      {space.kind === 'corner' ? <p>{space.name === 'Departure Gate' ? `Collect ${money(ALLOWANCE)} each lap.` : space.name === 'Hotel Stopover' ? `Just visiting is free. A stranded player rolls doubles to leave, or pays ${money(HOTEL_FEE)}, or after three tries must pay.` : space.name === 'Scenic Stopover' ? 'Missed flight: go to the Hotel Stopover.' : 'A free stop.'}</p> : null}
    </div>
  </section>
}

/** The stops each player holds, one tab per player and one line per stop with the fee a visitor pays now; select a line to read its full deed. */
function Hand({ state, name, current, onSelect, selected }: { state: State; name: (i: number) => string; current: number; onSelect: (i: number) => void; selected: number }) {
  const [who, setWho] = useState<number | null>(null)
  const p = who ?? current
  const cards = state.holdings.flatMap((h, i) => (h?.owner === p ? [i] : []))
  return <section className="wt-hand" aria-label="Property cards">
    <div className="wt-hand-tabs" role="group" aria-label="Whose cards">
      {state.players.map((pl, i) => <button key={i} type="button" aria-pressed={p === i} onClick={() => setWho(i)}>{name(i)}{pl.out ? ' (out)' : ''}</button>)}
    </div>
    {cards.length ? <ul className="wt-owned">{cards.map((i) => {
      const sp = BOARD[i]
      const h = state.holdings[i]!
      return <li key={i}><button type="button" aria-pressed={selected === i} onClick={() => onSelect(i)}>
        <span className="wt-dot" style={{ background: sp.kind === 'city' ? GROUP_COLOURS[sp.group] : '#7d8795' }} />
        <span className="wt-owned-name">{sp.name}</span>
        <span className="wt-owned-fee">{h.mortgaged ? 'mortgaged' : `${money(feeAt(state, i))} fee`}{h.centre ? ' ◆' : ''}</span>
      </button></li>
    })}</ul>
      : <p className="wt-hint">{name(p)} holds no stops yet. Claim one to list it here.</p>}
  </section>
}

function Manage({ state, act, name, online }: { state: State; act: (a: Action) => void; name: (i: number) => string; online?: boolean }) {
  const index = activePlayer(state)
  const owned = state.holdings.flatMap((h, i) => (h?.owner === index ? [i] : []))
  const others = state.players.flatMap((p, i) => (i === index || p.out ? [] : [i]))
  const [buyer, setBuyer] = useState(others[0] ?? 0)
  const [give, setGive] = useState<number[]>([])
  const [take, setTake] = useState<number[]>([])
  const [cash, setCash] = useState('0')
  const [error, setError] = useState('')
  const theirs = state.holdings.flatMap((h, i) => (h?.owner === buyer ? [i] : []))
  const toggle = (list: number[], set: (l: number[]) => void, i: number) => set(list.includes(i) ? list.filter((x) => x !== i) : [...list, i])
  const describe = (list: number[]) => (list.length ? list.map((i) => BOARD[i].name).join(', ') : 'nothing')
  const propose = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const offer = { buyer, give, take, cash: Number(cash) }
    const problem = offerProblem(state, index, offer)
    if (problem) { setError(problem); return }
    setError('')
    act({ type: 'offer', offer })
  }
  if (state.offer) {
    const o = state.offer
    return <section aria-label="Pending offer">
      <p role="status">{online ? `${name(o.buyer)}, a trade is proposed.` : `Pass the device to ${name(o.buyer)}.`} {name(index)} offers {describe(o.give)}{o.cash > 0 ? ` for ${money(o.cash)}` : o.cash < 0 ? ` with ${money(-o.cash)} from them to you` : ''}, and asks for {describe(o.take)}.</p>
      <div className="wt-actions"><button className="primary-btn" onClick={() => act({ type: 'accept' })}>Accept offer</button><button className="secondary-btn" onClick={() => act({ type: 'decline' })}>Decline offer</button></div>
    </section>
  }
  return <>
    {owned.length ? <details>
      <summary>Deals, mortgages and visitor centres</summary>
      <ul className="wt-props">{owned.map((i) => {
        const space = BOARD[i]
        const h = state.holdings[i]!
        return <li key={i}>{space.name}{h.mortgaged ? <em> (mortgaged)</em> : null}
          {space.kind === 'city' ? (h.centre ? <span>Visitor centre built</span> :
            <button className="secondary-btn" disabled={!canBuildCentre(state, index, i)} title="Needs every city in the colour group, none mortgaged" onClick={() => act({ type: 'upgrade', space: i })}>Build centre · {money(CENTRE_COST[space.group])}</button>) : null}
          {h.mortgaged ? <button className="secondary-btn" disabled={!canRedeem(state, index, i)} onClick={() => act({ type: 'redeem', space: i })}>Redeem · {money(redeemCost(space))}</button>
            : <button className="secondary-btn" disabled={!canMortgage(state, index, i)} title="Take half the price from the bank; no fees until redeemed" onClick={() => act({ type: 'mortgage', space: i })}>Mortgage · +{money(mortgageValue(space))}</button>}
        </li>
      })}</ul>
    </details> : null}
    {!state.traded && others.length ? <details>
      <summary>Propose a trade</summary>
      <form className="wt-form" onSubmit={propose}>
        <label>With <select value={buyer} onChange={(e) => { setBuyer(Number(e.target.value)); setTake([]) }}>{others.map((i) => <option key={i} value={i}>{name(i)}</option>)}</select></label>
        <fieldset><legend>You give</legend>{owned.filter((i) => !state.holdings[i]!.centre).map((i) => <label key={i}><input type="checkbox" checked={give.includes(i)} onChange={() => toggle(give, setGive, i)} /> {BOARD[i].name}</label>)}</fieldset>
        <fieldset><legend>You ask for</legend>{theirs.filter((i) => !state.holdings[i]!.centre).map((i) => <label key={i}><input type="checkbox" checked={take.includes(i)} onChange={() => toggle(take, setTake, i)} /> {BOARD[i].name}</label>)}{theirs.length ? null : <small>They own nothing yet.</small>}</fieldset>
        <label>Credits from them (negative: you pay) <input value={cash} onChange={(e) => setCash(e.target.value)} inputMode="numeric" pattern="-?[0-9]*" aria-label="Credits from them" /></label>
        <button className="secondary-btn">Offer trade</button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
    </details> : state.traded ? <p>Trade offer used for this turn.</p> : null}
  </>
}

/** The board, the action buttons and the side panel: shared by the single-device game and online rooms. */
export function Table({ state, act, name, status, canAct, thinking, extra, preview, online }: {
  state: State; act: (a: Action) => void; name: (i: number) => string; status: string
  /** Whether the person looking at this screen is the one who has to act now. */
  canAct: boolean
  /** What to say while someone else has to act; null for none. */
  thinking: string | null
  extra?: React.ReactNode
  /** Setup screen before a match: just the empty board. */
  preview?: boolean
  /** Online room: each player has their own screen, so there is no device to pass. */
  online?: boolean
}) {
  const [picked, setPicked] = useState<number | null>(null)
  /** After you roll, the board still shows where you stood until you press Move and walk your piece across the squares. */
  const [pending, setPending] = useState<{ before: State; who: number } | null>(null)
  const [walked, setWalked] = useState<number | null>(null)
  const current = activePlayer(state)
  const run = (a: Action) => { setPicked(null); if (a.type === 'roll' && !preview) setPending({ before: state, who: current }); act(a) }
  const moved = !!pending && state !== pending.before && state.turn === pending.before.turn && !!state.dice && state.players[pending.who].position !== pending.before.players[pending.who].position
  const total = state.dice ? state.dice[0] + state.dice[1] : 0
  useEffect(() => { if (pending && state !== pending.before && !moved) setPending(null) }, [state, pending, moved])
  useEffect(() => {
    if (!moved || walked === null) return
    const timer = setTimeout(() => { if (walked >= total) { setPending(null); setWalked(null) } else setWalked(walked + 1) }, walked >= total ? 280 : 190)
    return () => clearTimeout(timer)
  }, [moved, walked, total])
  const shown: State = moved && pending ? { ...pending.before, dice: state.dice, players: pending.before.players.map((p, i) => (i === pending.who && walked !== null ? { ...p, position: (p.position + walked) % BOARD.length } : p)) } : state
  const ranking = standings(shown)
  const viewIndex = picked ?? shown.players[current].position
  const landed = BOARD[shown.players[current].position]
  const waiting = !canAct
  const walking = moved && !waiting
  return <>
    <div className="wt-layout">
      <div className="wt-main">
        <Board state={shown} selected={viewIndex} onSelect={setPicked} status={walking ? `Rolled ${shown.dice?.[0]} and ${shown.dice?.[1]}. ${walked === null ? `Press Move to walk ${total} spaces.` : 'Walking…'}` : status} name={name} />
      {!preview && state.phase !== 'done' ? <div className="wt-actions">
        {waiting && thinking ? <p className="wt-thinking" role="status">{thinking}</p> : null}
        {walking ? <div className="wt-move"><button className="primary-btn" disabled={walked !== null} onClick={() => setWalked(0)}>{`Move ${total} spaces`}</button></div> : null}
        {!waiting && !walking && state.phase === 'roll' && state.players[current].inHotel ? <>
          {state.players[current].pass ? <button className="secondary-btn" onClick={() => run({ type: 'usepass' })}>Use boarding pass</button> : null}
          {state.players[current].cash >= HOTEL_FEE ? <button className="secondary-btn" onClick={() => run({ type: 'payout' })}>Pay {money(HOTEL_FEE)} to leave</button> : null}
        </> : null}
        {!waiting && !walking && state.phase === 'roll' ? <button className="primary-btn" onClick={() => run({ type: 'roll' })}>{state.players[current].inHotel ? 'Roll for doubles' : 'Roll dice'}</button> : null}
        {!waiting && !walking && state.phase === 'auction' && state.auction ? (() => {
          const { bid, order, pos } = state.auction
          const cash = state.players[order[pos]].cash
          return <>
            <p className="wt-auction" role="note"><strong>Auction: {BOARD[state.auction.space].name}.</strong> Highest bid wins it. {bid > 0 ? `Top bid ${money(bid)}.` : 'No bids yet.'} {name(order[pos])} to bid.</p>
            <button className="primary-btn" onClick={() => run({ type: 'bid', amount: bid + AUCTION_STEP })}>Bid {money(bid + AUCTION_STEP)}</button>
            {cash >= bid + 5 * AUCTION_STEP ? <button className="secondary-btn" onClick={() => run({ type: 'bid', amount: bid + 5 * AUCTION_STEP })}>Bid {money(bid + 5 * AUCTION_STEP)}</button> : null}
            <button className="secondary-btn" onClick={() => run({ type: 'drop' })}>Drop out (keep credits)</button>
          </>
        })() : null}
        {!waiting && !walking && state.phase === 'manage' && !state.offer ? <button className="primary-btn" onClick={() => run({ type: 'end' })}>{state.again ? 'Roll again' : 'End turn'}</button> : null}
        {!waiting && !walking && state.phase === 'buy' && isClaimable(landed) ? <>
          <button className="primary-btn" aria-label={`Claim ${landed.name} for ${money(landed.price)}`} onClick={() => run({ type: 'buy' })}>Claim · {money(landed.price)}</button>
          <button className="secondary-btn" onClick={() => run({ type: 'skip' })}>Pass</button>
        </> : null}
      </div> : null}
      </div>
      <div className="wt-side">
        <StopCard state={shown} index={viewIndex} name={name} />
        {!preview ? <Hand state={shown} name={name} current={current} onSelect={setPicked} selected={viewIndex} /> : null}
        {!preview && !walking && state.phase === 'manage' && !waiting ? <Manage key={state.turn} state={state} act={run} name={name} online={online} /> : null}
        {!preview ? <ul className="wt-balances" aria-label={state.phase === 'done' ? 'Final standings' : 'Player balances'}>
          {(state.phase === 'done' ? ranking : [...ranking].sort((a, b) => a.index - b.index)).map(({ index, cash, worth }) => <li key={index} data-active={state.phase !== 'done' && index === current ? 'true' : undefined}>
            <span className="wt-token" style={{ background: PLAYER_COLOURS[index] }}>{index + 1}</span>
            <span className="wt-bal"><strong>{name(index)}</strong><b>{state.players[index].out ? 'Out of the trip' : `${money(worth)} net worth`}</b><small>{state.players[index].inHotel ? 'At the Hotel Stopover · ' : ''}{state.players[index].pass ? 'Boarding pass · ' : ''}{money(cash)} credits{state.phase === 'done' ? ` · cities: ${state.collected[index].map((s) => BOARD[s].name).join(', ') || 'none'}` : ''}</small></span>
          </li>)}
        </ul> : null}
        {extra}
      </div>
    </div>
  </>
}


export function WorldTrip({ onFinish, seed }: GameProps) {
  const [match, setMatch] = useState(() => loadMatch(seed))
  const [count, setCount] = useState(2)
  const [computersWanted, setComputersWanted] = useState(1)
  const [turnsEach, setTurnsEach] = useState<number>(DEFAULT_TURNS)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const state = match?.state

  function start() {
    const next = { state: newGame(count, seed ?? String(createRandom()()), turnsEach), actions: [], startedAt: Date.now(), computers: Math.min(computersWanted, count - 1) }
    saveMatch(next)
    setMatch(next)
    setConfirmRestart(false)
  }
  function act(action: Action) {
    if (!match) return
    const next = applyAction(match.state, action)
    if (next === match.state) return
    const updated = { ...match, state: next, actions: [...match.actions, action] }
    saveMatch(updated)
    setMatch(updated)
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
  const view = state ?? newGame(count, '', turnsEach)
  const statusText = !state ? `Everyone starts at the Departure Gate with ${money(START_CASH)}.` : statusFor(state, name, relabel)

  return <div className="wt">
    {!state || state.phase === 'done' || confirmRestart ? <div className="wt-setup">
      <label>Players <select value={count} onChange={(e) => setCount(Number(e.target.value))}>{Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, k) => k + MIN_PLAYERS).map((n) => <option key={n} value={n}>{n} players</option>)}</select></label>
      <label>Computers <select value={Math.min(computersWanted, count - 1)} onChange={(e) => setComputersWanted(Number(e.target.value))}>{Array.from({ length: count }, (_, n) => <option key={n} value={n}>{n === 0 ? 'None' : n}</option>)}</select></label>
      <label>Turns each <select value={turnsEach} onChange={(e) => setTurnsEach(Number(e.target.value))}>{TURN_CHOICES.map((n) => <option key={n} value={n}>{n}{n === DEFAULT_TURNS ? ' (standard)' : ''}</option>)}</select></label>
      <button className="primary-btn" onClick={start}>{confirmRestart ? 'Replace match' : 'Start match'}</button>
      {confirmRestart ? <button className="secondary-btn" onClick={() => setConfirmRestart(false)}>Keep playing</button> : null}
    </div> : null}
    {state ? <Table state={state} act={act} name={name} status={statusText} canAct={!waiting} thinking={`${name(actor(state))} is playing…`}
      extra={state.phase !== 'done' && !confirmRestart ? <button className="secondary-btn" onClick={() => setConfirmRestart(true)}>New match</button> : null} />
      : <Table state={view} act={act} name={name} status={statusText} canAct={false} thinking={null} preview />}
    <details><summary>How to play</summary>
      <p>Roll two dice and travel clockwise round the 40 spaces. Passing or landing on the Departure Gate earns {money(ALLOWANCE)}. Claim an unowned city, airport or travel service when you land, or pass. Landing on another player’s stop costs its visitor fee.</p>
      <p>Own every city in a colour group to build visitor centres, which double a city’s fee. Draw Travel Cards for quick events, and pay the flat fees. Roll doubles to take another turn, but a third double in a row, a Fortune Card, or the Scenic Stopover sends you to the Hotel Stopover: roll doubles to leave, pay 50, use a boarding pass, or pay automatically after three tries. Own the whole colour group and its fees double; airports and travel services charge more for each one an owner holds. Pass on a stop and it goes to auction: everyone bids in turn, and the last bidder left wins it. Mortgage a stop for half its price (no fees on it until you redeem it for a little more). Propose one trade a turn, swapping stops and credits; pass the device to the buyer to accept or decline. If you cannot pay, your stops are sold back to the bank at half price; if that is still not enough you are out of the trip, and the last traveller left wins.</p>
      <p>After {state?.turnsEach ?? turnsEach} turns each, the highest net worth wins: credits plus the printed value of your stops and visitor centres. Ties share the win. Select any space on the board to see its details.</p>
    </details>
  </div>
}
