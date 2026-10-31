import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ShareButton } from '../components/ShareButton'
import { COLS } from '../games/connect4/rules'
import type { View } from '../games/connect4/online'
import { recordPlay } from '../lib/db'
import { roomSocketUrl } from '../lib/online'
import { isRoomCode } from '../lib/roomcode'

type Connected = [boolean, boolean]
type StateMessage = View & { type: 'state'; connected: Connected }
type Status = 'connecting' | 'open' | 'reconnecting' | 'failed' | 'replaced' | 'expired'

const RECONNECT_MS = [500, 1000, 2000, 4000]

/** Wins pay more the sooner they come; a draw is worth something; a loss nothing. Same shape as the single-player score. */
const scoreOf = (v: View) => (v.winner === v.you ? Math.max(100, 1000 - 30 * Math.ceil(v.moves / 2)) : v.draw ? 300 : 0)

function alreadyRecorded(key: string): boolean {
  try {
    const seen = JSON.parse(localStorage.getItem('govibearcadia.rooms') ?? '[]') as string[]
    if (seen.includes(key)) return true
    localStorage.setItem('govibearcadia.rooms', JSON.stringify([...seen.slice(-50), key]))
  } catch {
    /* storage unavailable: worst case a reload records the round again */
  }
  return false
}

export function RoomPage() {
  const { code = '' } = useParams()
  const valid = isRoomCode(code)
  const [status, setStatus] = useState<Status>('connecting')
  const [state, setState] = useState<StateMessage | null>(null)
  const [notice, setNotice] = useState('')
  const socket = useRef<WebSocket | null>(null)
  const startedAt = useRef(Date.now())
  const everOpen = useRef(false)

  useEffect(() => {
    if (!valid) return
    let closed = false
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      const ws = new WebSocket(roomSocketUrl(code, 'connect-four'))
      socket.current = ws
      ws.onopen = () => {
        everOpen.current = true
        attempt = 0
        setStatus('open')
      }
      ws.onmessage = (event) => {
        let msg: { type?: string; code?: string }
        try {
          msg = JSON.parse(String(event.data))
        } catch {
          return
        }
        if (msg.type === 'state') setState(msg as unknown as StateMessage)
        else if (msg.type === 'error') setNotice(msg.code === 'not-your-turn' ? 'Wait for your turn.' : msg.code === 'illegal-move' ? 'That column is full.' : msg.code === 'slow-down' ? 'Slow down a little.' : '')
      }
      ws.onclose = (event) => {
        if (closed) return
        if (event.code === 4000) return setStatus('replaced')
        if (event.code === 1000 && event.reason === 'room expired') return setStatus('expired')
        if (!everOpen.current) return setStatus('failed') // never got in: full, expired or offline
        setStatus('reconnecting')
        timer = setTimeout(connect, RECONNECT_MS[Math.min(attempt++, RECONNECT_MS.length - 1)])
      }
    }
    connect()
    return () => {
      closed = true
      clearTimeout(timer)
      socket.current?.close(1000)
    }
  }, [code, valid])

  // Record each finished round once on this device.
  useEffect(() => {
    if (!state || state.turn !== null) return
    if (state.winner === null && !state.draw) return
    if (alreadyRecorded(`${code}:${state.round}`)) return
    void recordPlay('connect-four', {
      score: scoreOf(state),
      durationMs: Date.now() - startedAt.current,
      won: state.winner === state.you,
      stats: { online: 1, moves: state.moves, outcome: state.winner === null ? 0 : state.winner === state.you ? 1 : -1 },
    })
    startedAt.current = Date.now()
  }, [state, code])

  const send = useCallback((message: object) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message))
  }, [])

  const you = state?.you
  const opp = you === undefined ? undefined : ((1 - you) as 0 | 1)
  const oppHere = state && opp !== undefined ? state.connected[opp] : false
  const [away, setAway] = useState(false)
  useEffect(() => {
    setAway(false)
    if (!state || oppHere) return
    const t = setTimeout(() => setAway(true), 30_000)
    return () => clearTimeout(t)
  }, [!!state, oppHere]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!valid) return <Navigate to="/online" replace />

  const over = !!state && state.turn === null
  const myTurn = !!state && state.turn === state.you
  const link = `${location.origin}/room/${code}`

  const headline =
    status === 'failed'
      ? 'Could not join this room'
      : status === 'expired'
        ? 'This room expired'
        : status === 'replaced'
        ? 'This room was opened in another tab'
        : !state
          ? 'Connecting…'
          : over
            ? state.draw
              ? 'Draw'
              : state.winner === state.you
                ? 'You win!'
                : 'You lose'
            : !oppHere
              ? 'Waiting for your friend…'
              : myTurn
                ? 'Your move'
                : "Friend's move"

  return (
    <main className="play-page">
      <div className="play-head">
        <Link to="/online" className="back">
          <ArrowLeft />
          Leave room
        </Link>
      </div>
      <div className="play-title room-title">
        <p className="eyebrow">Private room</p>
        <h1 aria-label={`Room ${code}`}>{code}</h1>
        <ShareButton text={link} label="Copy invite link" />
      </div>
      <section className="game-shell" aria-label="Online Connect Four">
        {status === 'failed' || status === 'expired' ? (
          <div className="game-over">
            <h3>{headline}</h3>
            <p>{status === 'expired' ? 'Rooms close after two hours without a move. Make a new one to keep playing.' : 'The room may be full, may have expired, or online play may be unavailable.'}</p>
            <Link className="primary-btn" to="/online">
              Back to rooms
            </Link>
          </div>
        ) : (
          <div className="c4">
            <div className="game-toolbar c4-bar">
              <div>
                <small>Status</small>
                <strong className="c4-status" aria-live="polite">
                  {status === 'reconnecting' ? 'Reconnecting…' : headline}
                </strong>
              </div>
              {state ? (
                <div>
                  <small>Score</small>
                  <strong aria-label="Score">
                    {state.wins[state.you]} – {state.wins[1 - state.you]}
                  </strong>
                </div>
              ) : null}
            </div>
            <div className="c4-board" data-over={over} data-thinking={!!state && !over && !myTurn}>
              <div className="c4-grid" aria-hidden="true">
                {(state?.cells ?? Array(42).fill(0)).map((p, i) => (
                  <div key={i} className="c4-cell" data-r={Math.floor(i / COLS)} data-c={i % COLS} data-p={state ? (p === 0 ? 0 : p) : 0} data-win={state?.line?.includes(i) ? 'true' : undefined} />
                ))}
              </div>
              <div className="c4-cols">
                {Array.from({ length: COLS }, (_, c) => (
                  <button key={c} data-col={c} aria-label={`Drop in column ${c + 1}`} disabled={!myTurn || over || !oppHere} onClick={() => send({ type: 'move', col: c })} />
                ))}
              </div>
            </div>
            <p className="game-help" role="status">
              {notice || (state ? `You are ${state.yourColour === 1 ? 'red' : 'yellow'}.${oppHere ? '' : away ? ' Your friend has been gone a while. You can keep waiting, share the link again, or leave the room.' : ' Share the code or link so your friend can join.'}` : '')}
            </p>
            {over ? (
              <div className="game-over">
                <h3>{headline}</h3>
                <button className="primary-btn" onClick={() => send({ type: 'rematch' })} disabled={state.rematch[state.you]}>
                  {state.rematch[state.you] ? 'Waiting for your friend…' : state.rematch[1 - state.you] ? 'Accept rematch' : 'Rematch'}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </main>
  )
}
