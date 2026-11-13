import { actor } from './worldtrip/bot'
import { activePlayer, type Action, type State } from './worldtrip/rules'
import { Table } from './WorldTrip'
import { statusFor } from './worldtrip/status'

/** One traveller's screen in an online room: the same board and buttons as the single-device game, driven by the server's state. */
export default function WorldTripOnline({ state, you, oppHere, canAct, onAct }: {
  state: State
  you: number
  oppHere: boolean
  canAct: boolean
  onAct: (action: Action) => void
}) {
  const name = (i: number) => `${i === you ? 'You' : 'Friend'} (Player ${i + 1})`
  const relabel = (text: string) => text.replace(/Pass the device to (Player \d)\./g, '$1 to move.').trim()
  const who = state.phase === 'done' ? activePlayer(state) : actor(state)
  const thinking = !oppHere ? 'Waiting for your friend to come back…' : who === you ? null : `${name(who)} is playing…`
  return <div className="wt wt-online">
    <Table state={state} act={onAct} name={name} status={statusFor(state, name, relabel)} canAct={canAct} thinking={thinking} online />
  </div>
}
