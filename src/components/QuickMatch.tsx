import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { OFFER_AFTER_MS, isMatchGame } from '../lib/matchmaking'
import { COMPUTER_GRACE_MS, computerLabel, pickComputer, type ComputerPlayer } from '../lib/computerPlayers'
import { fetchWaiting, matchSocketUrl, ONLINE_GAME_LIST, type OnlineGameId } from '../lib/online'

type Phase = 'idle' | 'searching' | 'found' | 'timeout' | 'full' | 'lost'

/**
 * Quick match for the two-player online games: press the button, wait for another player, and both land in the same
 * room. The screen never pretends the computer is a person: after 20 seconds it offers to keep waiting, play the
 * computer (the game's single-player page) or invite a friend (a private room).
 */
export function QuickMatch({ game, onInvite, autoStart = false }: { game: OnlineGameId; onInvite: () => void; autoStart?: boolean }) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [keepWaiting, setKeepWaiting] = useState(false)
  const [, setWaitingNow] = useState<number | null>(null)
  const [computer] = useState<ComputerPlayer>(() => pickComputer())
  const socket = useRef<WebSocket | null>(null)
  const title = ONLINE_GAME_LIST.find((g) => g.id === game)?.title ?? game

  const stop = useCallback(() => {
    const ws = socket.current
    socket.current = null
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'leave' }))
    ws?.close()
  }, [])
  useEffect(() => stop, [stop])

  const find = useCallback(() => {
    stop()
    setPhase('searching')
    setElapsed(0)
    setKeepWaiting(false)
    setCount(1)
    let ws: WebSocket
    try {
      ws = new WebSocket(matchSocketUrl(game))
    } catch {
      return setPhase('lost')
    }
    socket.current = ws
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join' }))
    ws.onmessage = (e) => {
      let m: { type?: string; count?: number; code?: string; code2?: string }
      try {
        m = JSON.parse(String(e.data))
      } catch {
        return
      }
      if (m.type === 'waiting' && typeof m.count === 'number') setCount(m.count)
      else if (m.type === 'matched' && typeof m.code === 'string') {
        const code = m.code
        socket.current = null
        setPhase('found')
        setTimeout(() => navigate(`/room/${code}?g=${game}&q=1`), 1800)
      } else if (m.type === 'timeout') setPhase('timeout')
      else if (m.type === 'error') setPhase('full')
    }
    ws.onclose = () => {
      if (socket.current === ws) {
        socket.current = null
        setPhase((p) => (p === 'searching' ? 'lost' : p))
      }
    }
  }, [game, navigate, stop])

  useEffect(() => {
    if (autoStart && isMatchGame(game)) find()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A different game cancels any search for the old one.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) return void (first.current = false)
    stop()
    setPhase('idle')
  }, [game, stop])

  useEffect(() => {
    if (phase !== 'searching') return
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  // Nobody came: after the grace period the named computer player takes the seat, clearly labelled.
  useEffect(() => {
    if (phase !== 'searching' || keepWaiting) return
    if (elapsed * 1000 >= OFFER_AFTER_MS + COMPUTER_GRACE_MS) navigate(`/play/${game}?vs=${computer}`)
  }, [phase, keepWaiting, elapsed, game, computer, navigate])

  // Keeps the real waiting count fresh in the background (not shown on screen at the moment).
  useEffect(() => {
    if (phase !== 'idle') return
    let live = true
    const load = () => void fetchWaiting().then((w) => live && setWaitingNow(w ? (w[game] ?? 0) : null))
    load()
    const t = setInterval(load, 10_000)
    return () => {
      live = false
      clearInterval(t)
    }
  }, [phase, game])

  const cancel = () => {
    stop()
    setPhase('idle')
  }

  if (phase === 'idle')
    return (
      <section className="quick-match" aria-label="Quick match">
        <h2>Quick match</h2>
        <p>Get paired with another player in {title}.</p>
        <button className="primary-btn" onClick={find}>
          Find a match
        </button>
      </section>
    )

  return (
    <section className="quick-match" aria-label="Quick match">
      <h2>Quick match</h2>
      {phase === 'searching' ? (
        <>
          <p role="status">
            Looking for an opponent in {title}… {elapsed}s{count > 1 ? ` · ${count} waiting` : ''}
          </p>
          {elapsed * 1000 >= OFFER_AFTER_MS && !keepWaiting ? (
            <div className="quick-offer" role="group" aria-label="Nobody yet">
              <p>
                No one else is here yet, so you will play {computerLabel(computer)} in a few seconds. You can:
              </p>
              <button className="secondary-btn" onClick={() => setKeepWaiting(true)}>
                Keep waiting for a person
              </button>
              <Link className="secondary-btn" to={`/play/${game}?vs=${computer}`}>
                Play {computerLabel(computer)} now
              </Link>
              <button className="secondary-btn" onClick={onInvite}>
                Invite a friend
              </button>
            </div>
          ) : null}
          <button className="secondary-btn" onClick={cancel}>
            Cancel
          </button>
        </>
      ) : null}
      {phase === 'found' ? <p role="status">Opponent found! Starting your game…</p> : null}
      {phase === 'timeout' ? (
        <>
          <p role="status">No one joined in time. Nothing was lost.</p>
          <button className="primary-btn" onClick={find}>
            Try again
          </button>
          <Link className="secondary-btn" to={`/play/${game}?vs=${computer}`}>
            Play {computerLabel(computer)} now
          </Link>
          <button className="secondary-btn" onClick={onInvite}>
            Invite a friend
          </button>
        </>
      ) : null}
      {phase === 'full' ? (
        <>
          <p role="alert">Quick match is very busy right now. Please try again in a minute.</p>
          <button className="secondary-btn" onClick={cancel}>
            Back
          </button>
        </>
      ) : null}
      {phase === 'lost' ? (
        <>
          <p role="alert">Quick match is not available right now. You can still create a private room or play the computer.</p>
          <button className="primary-btn" onClick={find}>
            Try again
          </button>
          <button className="secondary-btn" onClick={cancel}>
            Back
          </button>
        </>
      ) : null}
    </section>
  )
}
