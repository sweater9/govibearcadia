import type { State } from './worldtrip/rules'
import { MAX_PLAYERS, MIN_PLAYERS } from './worldtrip/rules'
import { PLAYER_COLOURS } from './worldtrip/colours'
import WorldTripOnline from './WorldTripOnline'

/** What the Worker sends a World Trip seat. Before the host starts, `lobby` is true and there is no board. */
export type WorldTripMessage = {
  you: number
  turn: number | null
  winner: number | null
  draw: boolean
  round: number
  wins: number[]
  rematch: boolean[]
  connected: boolean[]
  lobby: boolean
  host: number
  seated: number
  board: State | null
}

type Props = { state: WorldTripMessage | null; reconnecting: boolean; notice: string; send: (message: object) => void }

/** The whole online World Trip room: the lobby where up to six travellers gather, then the trip itself. */
export default function WorldTripRoom({ state, reconnecting, notice, send }: Props) {
  const here = state ? state.connected.filter(Boolean).length : 0
  const over = !!state && !state.lobby && state.turn === null
  const myTurn = !!state && state.turn === state.you
  const isHost = !!state && state.host === state.you
  const headline = reconnecting ? 'Reconnecting…'
    : !state ? 'Connecting…'
    : state.lobby ? (isHost ? (here >= MIN_PLAYERS ? 'Ready when you are' : 'Waiting for travellers…') : 'Waiting for the host…')
    : over ? (state.draw ? 'Tie' : state.winner === state.you ? 'You win!' : `Player ${(state.winner ?? 0) + 1} wins`)
    : myTurn ? 'Your move' : `Player ${(state.turn ?? 0) + 1}'s move`
  const readyCount = state ? state.rematch.filter((r, i) => r && state.connected[i]).length : 0

  return <div className="wt-room">
    <div className="game-toolbar c4-bar">
      <div>
        <small>Status</small>
        <strong className="c4-status" aria-live="polite">{headline}</strong>
      </div>
      {state ? <div><small>Wins</small><strong aria-label="Your wins">{state.wins[state.you]}</strong></div> : null}
    </div>
    {!state ? <p>Connecting…</p>
      : state.lobby ? <section className="wt-lobby" aria-label="Lobby">
        <h3>Travellers</h3>
        <ul aria-label="Seats">
          {Array.from({ length: MAX_PLAYERS }, (_, i) => {
            const taken = i < state.seated
            return <li key={i} data-open={!taken} data-away={taken && !state.connected[i]}>
              <span className="wt-token" aria-hidden="true" style={{ background: PLAYER_COLOURS[i] }}>{i + 1}</span>
              {taken ? `Player ${i + 1}${i === state.you ? ' (you)' : ''}${i === state.host ? ', host' : ''}${state.connected[i] ? '' : ', away'}` : 'Open seat'}
            </li>
          })}
        </ul>
        {isHost
          ? <button className="primary-btn" disabled={here < MIN_PLAYERS} onClick={() => send({ type: 'start' })}>Start trip</button>
          : <p>Player {state.host + 1} starts the trip when everyone is here.</p>}
      </section>
      : <WorldTripOnline state={state.board!} you={state.you} connected={state.connected} canAct={myTurn && !over}
        onAct={(action) => send({ type: 'move', action })} onRemove={(seat) => send({ type: 'remove', seat })} />}
    <p className="game-help" role="status">
      {notice || (state ? (state.lobby ? `You are Player ${state.you + 1}. Share the invite link: up to ${MAX_PLAYERS} travellers can join before the trip starts.` : `You are Player ${state.you + 1}.`) : '')}
    </p>
    {over && state ? <div className="game-over">
      <h3>{headline}</h3>
      <button className="primary-btn" onClick={() => send({ type: 'rematch' })} disabled={state.rematch[state.you]}>
        {state.rematch[state.you] ? `Waiting for the others (${readyCount} of ${here} ready)` : readyCount ? 'Accept rematch' : 'Rematch'}
      </button>
    </div> : null}
  </div>
}
