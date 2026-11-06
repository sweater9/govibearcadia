import { useState, type FormEvent } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { activePlayer, applyAction, BOARD, money, newGame, playerName, rentFor, ROUNDS, standings, UPGRADE, type Action, type State } from './bazaar/rules'
import { loadMatch, saveMatch } from './bazaar/save'
import './bazaar/bazaar.css'

const GRID_AREAS = [
  'a', 'b', 'c', 'd', 'e', 'j', 'o', 't', 'y', 'x', 'w', 'v', 'u', 'p', 'k', 'f',
]

function MarketBoard({ state }: { state: State }) {
  return <ol className="bazaar-board" aria-label="Market board in travel order">
    {BOARD.map((space, index) => {
      const holding = state.holdings[index]
      const visitors = state.players.flatMap((player, i) => player.position === index ? [i] : [])
      return <li key={index} style={{ gridArea: GRID_AREAS[index] }} data-kind={space.kind}>
        <strong>{space.name}</strong>
        {space.kind === 'property' ? <small>{holding
          ? `P${holding.owner + 1} · ${money(rentFor(space.rent, holding.shop))} rent`
          : money(space.price)}</small> : null}
        {visitors.length ? <span aria-label={visitors.map(playerName).join(', ')}>{visitors.map((i) => `P${i + 1}`).join(' ')}</span> : null}
      </li>
    })}
  </ol>
}

function Manage({ state, act }: { state: State; act: (action: Action) => void }) {
  const index = activePlayer(state)
  const owned = state.holdings.flatMap((holding, i) => holding?.owner === index ? [i] : [])
  const [error, setError] = useState('')
  const propose = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const offer = { property: Number(fields.get('property')), buyer: Number(fields.get('buyer')), price: Number(fields.get('price')) }
    if (offer.price > state.players[offer.buyer].cash) {
      setError('That buyer does not have enough cash.')
      return
    }
    setError('')
    act({ type: 'offer', offer })
  }

  if (state.offer) {
    const { buyer, property, price } = state.offer
    return <section aria-label="Pending property offer">
      <p role="status">Pass the device to {playerName(buyer)}. Buy {BOARD[property].name} from {playerName(index)} for {money(price)}?</p>
      <div className="bazaar-actions">
        <button className="primary-btn" onClick={() => act({ type: 'accept' })}>Accept offer</button>
        <button className="secondary-btn" onClick={() => act({ type: 'decline' })}>Decline offer</button>
      </div>
    </section>
  }

  return <>
    <button className="primary-btn" onClick={() => act({ type: 'end' })}>End turn</button>
    {owned.length ? <details>
      <summary>Manage properties</summary>
      <ul className="bazaar-properties">{owned.map((i) => <li key={i}>
        {BOARD[i].name}
        {state.holdings[i]?.shop ? <span>Shop</span> : <button className="secondary-btn"
          disabled={state.players[index].cash < UPGRADE} onClick={() => act({ type: 'upgrade', property: i })}>
          Upgrade · {money(UPGRADE)}
        </button>}
      </li>)}</ul>
      {!state.traded ? <form className="bazaar-actions" onSubmit={propose}>
        <label>Property <select name="property">{owned.map((i) => <option key={i} value={i}>{BOARD[i].name}</option>)}</select></label>
        <label>Buyer <select name="buyer">{state.players.map((_, i) => i === index ? null : <option key={i} value={i}>{playerName(i)}</option>)}</select></label>
        <label>Price (₹) <input name="price" type="number" min="1" step="1" required /></label>
        <button className="secondary-btn">Offer sale</button>
        {error ? <p role="alert">{error}</p> : null}
      </form> : <p>Trade offer used for this turn.</p>}
    </details> : null}
  </>
}

export function Bazaar({ onFinish, seed }: GameProps) {
  const [match, setMatch] = useState(() => loadMatch(seed))
  const [count, setCount] = useState(2)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const state = match?.state

  function start() {
    const next = { state: newGame(count, seed ?? String(createRandom()())), actions: [], startedAt: Date.now() }
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
      onFinish({ score: standings(next)[0].worth, won: true, durationMs: Math.max(0, Date.now() - match.startedAt),
        stats: { players: next.players.length, turns: next.turn } })
    }
  }

  const current = state ? activePlayer(state) : 0
  const landed = state ? BOARD[state.players[current].position] : null
  const ranking = state ? standings(state) : []
  const leaders = ranking.filter((entry) => entry.worth === ranking[0].worth)
  return <div className="bazaar">
    {!state || state.phase === 'done' || confirmRestart ? <div className="bazaar-actions">
      <label>Players <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
        {[2, 3, 4].map((n) => <option key={n} value={n}>{n} players</option>)}
      </select></label>
      <button className="primary-btn" onClick={start}>{confirmRestart ? 'Replace match' : 'Start match'}</button>
      {confirmRestart ? <button className="secondary-btn" onClick={() => setConfirmRestart(false)}>Keep playing</button> : null}
    </div> : null}
    <p role="status" className="bazaar-status">
      {!state ? 'Everyone starts at Market Gate with ₹400.' : state.phase === 'done'
        ? `${leaders.map(({ index }) => playerName(index)).join(' and ')} ${leaders.length > 1 ? 'tie' : 'wins'} with ${money(leaders[0].worth)}.`
        : `Round ${Math.floor(state.turn / state.players.length) + 1} of ${ROUNDS} · ${playerName(current)}. ${state.dice ? `Rolled ${state.dice.join(' + ')}. ` : ''}${state.message}`}
    </p>
    <MarketBoard state={state ?? newGame(count, '')} />
    {state ? <ul className="bazaar-balances" aria-label={state.phase === 'done' ? 'Final standings' : 'Player balances'}>
      {(state.phase === 'done' ? ranking : [...ranking].sort((a, b) => a.index - b.index)).map(({ index, cash, worth }) =>
        <li key={index}><strong>{playerName(index)}</strong> · {money(cash)} cash · {money(worth)} net worth</li>)}
    </ul> : null}
    {state && state.phase !== 'done' ? <div className="bazaar-controls">
      {state.phase === 'roll' ? <button className="primary-btn" onClick={() => act({ type: 'roll' })}>Roll dice</button> : null}
      {state.phase === 'buy' && landed?.kind === 'property' ? <div className="bazaar-actions">
        <button className="primary-btn" onClick={() => act({ type: 'buy' })}>Buy {landed.name} · {money(landed.price)}</button>
        <button className="secondary-btn" onClick={() => act({ type: 'skip' })}>Pass on purchase</button>
      </div> : null}
      {state.phase === 'manage' ? <Manage key={state.turn} state={state} act={act} /> : null}
      {!confirmRestart ? <button className="secondary-btn" onClick={() => setConfirmRestart(true)}>New match</button> : null}
    </div> : null}
    <details><summary>How to play</summary>
      <p>Roll two dice and travel clockwise. Passing Market Gate earns ₹50. Buy an empty property where you land, or pay rent to its owner. Market News can add or deduct cash. If you run short, you pay what you have and keep playing.</p>
      <p>After rolling and settling your landing, you can upgrade any stall you own for ₹80 to double its rent. You can offer one property for sale each turn. Pass the device to the buyer to accept or decline, then return it to finish your turn.</p>
      <p>After {ROUNDS} turns each, the highest net worth wins. Add cash, printed property prices and ₹80 per shop. Equal totals share the win.</p>
    </details>
  </div>
}
