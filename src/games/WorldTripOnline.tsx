import { useEffect, useState } from 'react'
import { actor } from './worldtrip/bot'
import { activePlayer, type Action, type State } from './worldtrip/rules'
import { Table } from './WorldTrip'
import { statusFor } from './worldtrip/status'

/** How long a traveller must be gone, on this screen, before the others may remove them. */
export const AWAY_MS = 30_000

/** One traveller's screen in an online room: the same board and buttons as the single-device game, driven by the server's state. */
export default function WorldTripOnline({ state, you, connected, canAct, onAct, onRemove }: {
  state: State
  you: number
  connected: boolean[]
  canAct: boolean
  onAct: (action: Action) => void
  onRemove: (seat: number) => void
}) {
  const name = (i: number) => (i === you ? `You (Player ${i + 1})` : `Player ${i + 1}`)
  const relabel = (text: string) => text.replace(/Pass the device to (Player \d)\./g, '$1 to move.').trim()
  const who = state.phase === 'done' ? activePlayer(state) : actor(state)
  const gone = state.phase !== 'done' && who !== you && !connected[who]
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    setWaited(false)
    if (!gone) return
    const timer = setTimeout(() => setWaited(true), AWAY_MS)
    return () => clearTimeout(timer)
  }, [gone, who])
  const thinking = gone ? `${name(who)} has left the room. Their move is holding the trip up.` : who === you ? null : `${name(who)} is playing…`
  return <div className="wt wt-online">
    <Table state={state} act={onAct} name={name} status={statusFor(state, name, relabel)} canAct={canAct} thinking={thinking} online
      extra={gone && waited ? <button className="secondary-btn" onClick={() => onRemove(who)}>Remove Player {who + 1}</button> : null} />
  </div>
}
