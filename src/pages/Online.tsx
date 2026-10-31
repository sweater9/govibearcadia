import { Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ONLINE_GAME_LIST, createRoom, type OnlineGameId } from '../lib/online'
import { isRoomCode, normaliseRoomCode } from '../lib/roomcode'

export function Online() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [game, setGame] = useState<OnlineGameId>('connect-four')

  const create = async () => {
    setBusy(true)
    setError('')
    const made = await createRoom()
    setBusy(false)
    if (made) navigate(`/room/${made}?g=${game}`)
    else setError('Online play is not available right now. You can still play every game on your own.')
  }
  const join = () => {
    const c = normaliseRoomCode(code)
    if (!isRoomCode(c)) return setError('Room codes have 6 letters and numbers, like K7M2PQ.')
    navigate(`/room/${c}?g=${game}`)
  }

  return (
    <main className="online">
      <p className="eyebrow">Play with a friend</p>
      <h1>
        <Users size={30} /> Online rooms
      </h1>
      <p className="text-white/70">Make a private room, send the code or link to a friend, and play together. No account needed.</p>
      <label className="online-game">
        Game
        <select aria-label="Game" value={game} onChange={(e) => setGame(e.target.value as OnlineGameId)}>
          {ONLINE_GAME_LIST.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </label>
      <div className="online-actions">
        <button className="primary-btn" onClick={() => void create()} disabled={busy}>
          Create a room
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            join()
          }}
        >
          <input aria-label="Room code" placeholder="Room code" value={code} maxLength={9} autoCapitalize="characters" autoComplete="off" onChange={(e) => setCode(e.target.value)} />
          <button className="secondary-btn" type="submit">
            Join
          </button>
        </form>
      </div>
      <p role="alert" className="online-error">
        {error}
      </p>
      <p className="text-white/55">Rooms are private, hold two players, and a friend joining by code must pick the same game. Rooms close after two idle hours. Nothing about you is shared except the moves you make.</p>
    </main>
  )
}
