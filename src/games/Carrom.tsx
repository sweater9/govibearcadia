import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { chooseShot, LEVELS, type Level } from './carrom/ai'
import { clearSaved, loadSaved, save, type Opponent, type Saved } from './carrom/save'
import { DEFAULT_AIM, MAX_ANGLE, newMatch, nextBoard, remaining, resolveShot, sideOf, strikerBlocked, type Aim, type Event, type State } from './carrom/rules'
import type { BoardApi } from './carrom/board'

const SIDE = ['White', 'Black']
const deg = (r: number) => Math.round((r * 180) / Math.PI)

function seatName(seat: number, players: number, opponent: Opponent) {
  if (players === 2) return opponent === 'computer' ? (seat === 0 ? 'You' : 'Computer') : `Player ${seat + 1}`
  return opponent === 'computer' ? (seat === 0 ? 'You' : `Computer ${seat}`) : `Player ${seat + 1}`
}

function describe(events: Event[], name: (seat: number) => string): string {
  const out: string[] = []
  for (const e of events) {
    switch (e.type) {
      case 'pocket': out.push(`${name(e.seat)} pocketed ${e.kind === 'queen' ? 'the queen' : `a ${e.kind} coin`}`); break
      case 'foul': out.push(e.reason === 'striker' ? `Foul: ${name(e.seat)}'s striker went in` : e.reason === 'opponent-coin' ? 'Foul: an opponent coin went in, turn lost' : e.reason === 'last-coin-before-queen' ? 'Foul: last coin before the queen was covered' : 'Foul: the opponent’s last coin'); break
      case 'queen-covered': out.push('The queen is covered'); break
      case 'queen-pending': out.push('Queen down: cover it with your next shot'); break
      case 'queen-returned': out.push('The queen goes back to the centre'); break
      case 'penalty-owed': out.push('A penalty coin is owed'); break
      case 'board-won': out.push(`${SIDE[e.side]} wins the board for ${e.points} point${e.points === 1 ? '' : 's'}`); break
      case 'match-over': out.push(e.winner === 'draw' ? 'The match is drawn' : `${SIDE[e.winner]} wins the match`); break
      default: break
    }
  }
  return out.length ? `${out.join('. ')}.` : ''
}

export function Carrom({ onFinish, seed }: GameProps) {
  const [resume] = useState<Saved | null>(() => loadSaved())
  const [players, setPlayers] = useState<2 | 4>(2)
  const [opponent, setOpponent] = useState<Opponent>('computer')
  const [level, setLevel] = useState<Level>('medium')
  const [started, setStarted] = useState(false)
  const [state, setState] = useState<State>(() => newMatch())
  const [aim, setAim] = useState<Aim>(DEFAULT_AIM)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [boardReady, setBoardReady] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  const api = useRef<BoardApi | null>(null)
  const startedAt = useRef(0)
  const reported = useRef(false)
  const stateRef = useRef(state)
  const aimRef = useRef(aim)
  const busyRef = useRef(false)
  stateRef.current = state
  aimRef.current = aim
  const random = useMemo(() => createRandom(seed ?? `carrom-${Date.now()}`), [seed])

  const isComputer = (seat: number) => opponent === 'computer' && seat !== 0

  const begin = (s: State, saved?: Saved) => {
    reported.current = false
    startedAt.current = saved?.startedAt ?? Date.now()
    setState(s)
    setAim(DEFAULT_AIM)
    setStatus('')
    setStarted(true)
  }

  // Mount the board (and Phaser with it) only once a match starts: other pages never download it.
  useEffect(() => {
    if (!started || !host.current) return
    let cancelled = false
    let mounted: BoardApi | null = null
    import('./carrom/board').then(({ mountBoard }) => {
      if (cancelled || !host.current) return
      mounted = mountBoard(host.current, {
        onAim: (a) => setAim((prev) => ({ ...prev, ...a })),
        onShoot: () => strikeRef.current(),
      })
      api.current = mounted
      setBoardReady(true)
    })
    return () => {
      cancelled = true
      setBoardReady(false)
      mounted?.destroy()
      api.current = null
    }
  }, [started])

  const playing = started && state.phase === 'aim'
  const myTurnHuman = playing && !isComputer(state.turn) && !busy

  useEffect(() => {
    if (!boardReady) return
    api.current?.sync(state.coins, state.turn, aim, myTurnHuman)
  }, [boardReady, state, aim, myTurnHuman])

  const strike = useCallback(() => {
    const s = stateRef.current
    if (!api.current || busyRef.current || s.phase !== 'aim') return
    const a = aimRef.current
    if (strikerBlocked(s.coins, s.turn, a.t)) {
      setStatus('A coin is in the way: slide the striker to a clear spot.')
      return
    }
    busyRef.current = true
    setBusy(true)
    const before = s
    api.current.shoot(s.turn, a).then((outcome) => {
      busyRef.current = false
      const next = resolveShot(before, outcome)
      setBusy(false)
      setState(next)
      if (next.turn !== before.turn || next.phase !== 'aim') setAim(DEFAULT_AIM)
      setStatus(describe(next.events, (seat) => seatName(seat, next.config.players, opponent)))
    })
  }, [opponent])
  const strikeRef = useRef(strike)
  strikeRef.current = strike

  // Computer turns.
  useEffect(() => {
    if (!boardReady || !playing || busy || !isComputer(state.turn)) return
    const t1 = setTimeout(() => {
      const a = chooseShot(stateRef.current, stateRef.current.turn, level, random)
      setAim(a)
      aimRef.current = a
      setTimeout(() => strikeRef.current(), 600)
    }, 500)
    return () => clearTimeout(t1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardReady, playing, busy, state.turn, state.phase, state.board])

  // Save progress between shots; report the result once.
  useEffect(() => {
    if (!started) return
    if (state.phase === 'over') {
      clearSaved()
      if (!reported.current) {
        reported.current = true
        onFinish({
          score: state.scores[0],
          durationMs: Date.now() - startedAt.current,
          won: state.winner === 0,
          stats: { boards: state.board, opponentScore: state.scores[1], players: state.config.players, level: LEVELS.indexOf(level) + 1, computer: opponent === 'computer' ? 1 : 0 },
        })
      }
    } else if (!busy) save({ v: 1, opponent, level, startedAt: startedAt.current, state })
  }, [started, state, busy, opponent, level, onFinish])

  const finishNow = () => {
    if (busyRef.current) return
    setState((s) => {
      if (s.phase === 'over') return s
      return { ...s, phase: 'over', winner: s.scores[0] === s.scores[1] ? 'draw' : s.scores[0] > s.scores[1] ? 0 : 1 }
    })
  }

  if (!started) {
    return (
      <div className="cm-setup">
        <h2>Carrom</h2>
        <p className="cm-note">Standard rules: pocket your colour, cover the queen, first to 25 points or after eight boards.</p>
        <div className="cm-row" role="group" aria-label="Players">
          {[2, 4].map((n) => (
            <button key={n} type="button" className={`secondary-btn${players === n ? ' cm-on' : ''}`} aria-pressed={players === n} onClick={() => setPlayers(n as 2 | 4)}>
              {n === 2 ? '2 players' : '4 players (doubles)'}
            </button>
          ))}
        </div>
        <div className="cm-row" role="group" aria-label="Opponents">
          {(['computer', 'people'] as const).map((o) => (
            <button key={o} type="button" className={`secondary-btn${opponent === o ? ' cm-on' : ''}`} aria-pressed={opponent === o} onClick={() => setOpponent(o)}>
              {o === 'computer' ? 'Play the computer' : 'Pass and play'}
            </button>
          ))}
        </div>
        {opponent === 'computer' && (
          <div className="cm-row" role="group" aria-label="Difficulty">
            {LEVELS.map((l) => (
              <button key={l} type="button" className={`secondary-btn${level === l ? ' cm-on' : ''}`} aria-pressed={level === l} onClick={() => setLevel(l)}>
                {l[0].toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        )}
        <div className="cm-row">
          <button type="button" className="primary-btn" onClick={() => begin(newMatch({ players }))}>Start match</button>
          {resume && (
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                setOpponent(resume.opponent)
                setLevel(resume.level)
                setPlayers(resume.state.config.players)
                begin(resume.state, resume)
              }}
            >
              Resume saved match
            </button>
          )}
        </div>
      </div>
    )
  }

  const names = Array.from({ length: state.config.players }, (_, i) => seatName(i, state.config.players, opponent))
  const blocked = strikerBlocked(state.coins, state.turn, aim.t)
  return (
    <div className="cm-wrap">
      <div className="cm-scores" aria-live="polite">
        {[0, 1].map((side) => (
          <span key={side} className={`cm-score${sideOf(state.turn) === side && state.phase === 'aim' ? ' cm-score-turn' : ''}`}>
            {SIDE[side]} <strong data-testid={`cm-score-${side}`}>{state.scores[side]}</strong> <small>({remaining(state, side as 0 | 1)} left)</small>
          </span>
        ))}
        <span className="cm-score">
          Board <strong>{state.board}/{state.config.maxBoards}</strong> <small>(queen {state.queen === 'covered' ? 'covered' : state.queen === 'pending' ? 'to cover' : 'on board'})</small>
        </span>
      </div>

      <div className="cm-board" ref={host} data-testid="cm-board" />

      <p className="cm-status" role="status" aria-live="polite">
        {state.phase === 'over'
          ? state.winner === 'draw' ? 'The match is drawn.' : `${SIDE[state.winner as number]} wins the match, ${state.scores[0]} to ${state.scores[1]}.`
          : state.phase === 'board-over'
            ? `${SIDE[state.lastBoard!.winner]} wins board ${state.board} for ${state.lastBoard!.points}.`
            : busy ? `${names[state.turn]} strikes…` : `${names[state.turn]} to shoot (${SIDE[sideOf(state.turn)]}).`}{' '}
        {status}
      </p>

      {state.phase === 'aim' && (
        <div className="cm-controls">
          <label>
            Position
            <input type="range" min={-100} max={100} value={Math.round(aim.t * 100)} disabled={!myTurnHuman} onChange={(e) => setAim((a) => ({ ...a, t: Number(e.target.value) / 100 }))} aria-valuetext={`${Math.round(aim.t * 100)} percent along the line`} />
          </label>
          <label>
            Angle
            <input type="range" min={-deg(MAX_ANGLE)} max={deg(MAX_ANGLE)} value={deg(aim.angle)} disabled={!myTurnHuman} onChange={(e) => setAim((a) => ({ ...a, angle: (Number(e.target.value) * Math.PI) / 180 }))} aria-valuetext={`${deg(aim.angle)} degrees`} />
          </label>
          <label>
            Power
            <input type="range" min={10} max={100} value={Math.round(aim.power * 100)} disabled={!myTurnHuman} onChange={(e) => setAim((a) => ({ ...a, power: Number(e.target.value) / 100 }))} aria-valuetext={`${Math.round(aim.power * 100)} percent`} />
          </label>
        </div>
      )}
      <div className="cm-row">
        {state.phase === 'aim' && <button type="button" className="primary-btn" disabled={!myTurnHuman || blocked} onClick={strike}>Strike</button>}
        {state.phase === 'board-over' && <button type="button" className="primary-btn" onClick={() => setState((s) => nextBoard(s))}>Next board</button>}
        {state.phase === 'over' && <button type="button" className="primary-btn" onClick={() => { setStarted(false); setState(newMatch()) }}>New match</button>}
        {state.phase !== 'over' && <button type="button" className="secondary-btn" disabled={busy} onClick={finishNow}>Finish match</button>}
      </div>
    </div>
  )
}
