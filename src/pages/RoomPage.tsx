import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ShareButton } from '../components/ShareButton'
import { COLS } from '../games/connect4/rules'
import type { View } from '../games/connect4/online'
import { CheckersBoard } from '../games/checkers/Board'
import { interact, legalSteps as legalStepsFor, newGame as newCheckers, type CState } from '../games/checkers/rules'
import { TicTacToeBoard } from '../games/tictactoe/Board'
import type { TState } from '../games/tictactoe/rules'
import { recordPlay } from '../lib/db'
import { ONLINE_GAME_LIST, gameFromParam, roomSocketUrl, type OnlineGameId } from '../lib/online'
import { isRoomCode } from '../lib/roomcode'

type Connected = [boolean, boolean]
/** Connect Four sends its board flat (cells, line, moves); the other games nest it under `board`. */
type Common = Pick<View, 'you' | 'yourColour' | 'turn' | 'winner' | 'draw' | 'round' | 'wins' | 'rematch'>
type StateMessage = Common & Partial<Pick<View, 'cells' | 'line' | 'moves'>> & { type: 'state'; connected: Connected; board?: unknown }
type Status = 'connecting' | 'open' | 'reconnecting' | 'failed' | 'replaced' | 'expired'

const RECONNECT_MS = [500, 1000, 2000, 4000]

const movesOf = (v: StateMessage) => v.moves ?? (v.board as { moves?: number } | undefined)?.moves ?? 0

/** Wins pay more the sooner they come; a draw is worth something; a loss nothing. Same shape as each single-player score. */
function scoreOf(game: OnlineGameId, v: StateMessage): number {
  const moves = movesOf(v)
  const won = v.winner === v.you
  if (game === 'tic-tac-toe') return won ? 500 + 100 * (5 - Math.ceil(moves / 2)) : v.draw ? 200 : 0
  if (game === 'checkers') return won ? Math.max(400, 1000 - 4 * moves) : v.draw ? 300 : 0
  return won ? Math.max(100, 1000 - 30 * Math.ceil(moves / 2)) : v.draw ? 300 : 0
}

const COLOURS: Record<OnlineGameId, [string, string]> = { 'connect-four': ['red', 'yellow'], 'tic-tac-toe': ['X', 'O'], checkers: ['red', 'white'] }

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
  const [params] = useSearchParams()
  const game = gameFromParam(params.get('g'))
  const [picked, setPicked] = useState<number | null>(null)
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
      const ws = new WebSocket(roomSocketUrl(code, game))
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
  }, [code, valid, game])

  // Record each finished round once on this device.
  useEffect(() => {
    if (!state || state.turn !== null) return
    if (state.winner === null && !state.draw) return
    if (alreadyRecorded(`${code}:${state.round}`)) return
    void recordPlay(game, {
      score: scoreOf(game, state),
      durationMs: Date.now() - startedAt.current,
      won: state.winner === state.you,
      stats: { online: 1, moves: movesOf(state), outcome: state.winner === null ? 0 : state.winner === state.you ? 1 : -1 },
    })
    startedAt.current = Date.now()
  }, [state, code, game])

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

  const checkers = (game === 'checkers' && state?.board ? (state.board as CState) : newCheckers()) as CState
  const targets = new Set<number>()
  if (game === 'checkers' && state && state.turn === state.you) {
    const from = checkers.chain ?? picked
    if (from !== null) for (const m of legalStepsFor(checkers)) if (m.from === from) targets.add(m.to)
  }

  if (!valid) return <Navigate to="/online" replace />

  const over = !!state && state.turn === null
  const myTurn = !!state && state.turn === state.you
  const link = `${location.origin}/room/${code}?g=${game}`
  const title = ONLINE_GAME_LIST.find((g) => g.id === game)!.title

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
      <section className="game-shell" aria-label={`Online ${title}`}>
        {status === 'failed' || status === 'expired' ? (
          <div className="game-over">
            <h3>{headline}</h3>
            <p>{status === 'expired' ? 'Rooms close after two hours without a move. Make a new one to keep playing.' : 'The room may be full, may have expired, may be a different game (check you picked the same one as your friend), or online play may be unavailable.'}</p>
            <Link className="primary-btn" to="/online">
              Back to rooms
            </Link>
          </div>
        ) : (
          <div className={game === 'connect-four' ? 'c4' : game === 'tic-tac-toe' ? 'ttt' : 'ck'}>
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
            {game === 'connect-four' ? (
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
            ) : game === 'tic-tac-toe' ? (
              <TicTacToeBoard
                cells={(state?.board as TState | undefined)?.cells ?? Array(9).fill(0)}
                line={(state?.board as TState | undefined)?.line ?? null}
                disabled={!myTurn || over || !oppHere}
                onCell={(cell) => send({ type: 'move', cell })}
              />
            ) : (
              <CheckersBoard
                cells={checkers.cells}
                selected={myTurn ? (checkers.chain ?? picked) : null}
                targets={targets}
                flip={state?.yourColour === 2}
                disabled={!myTurn || over || !oppHere}
                onSquare={(i) => {
                  const r = interact(checkers, state?.yourColour ?? 1, myTurn ? (checkers.chain ?? picked) : null, i)
                  setPicked(r.select)
                  if (r.move) send({ type: 'move', from: r.move.from, to: r.move.to })
                }}
              />
            )}
            <p className="game-help" role="status">
              {notice || (state ? `You are ${COLOURS[game][state.yourColour - 1]}.${oppHere ? '' : away ? ' Your friend has been gone a while. You can keep waiting, share the link again, or leave the room.' : ' Share the code or link so your friend can join.'}` : '')}
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
