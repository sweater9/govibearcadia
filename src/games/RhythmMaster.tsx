import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import type { GameProps } from '../types'
import { playBeat, playJudge } from './rhythm/audio'
import { LANES, LEVELS, TRACKS, TRACK_IDS, accuracy, advance, beatMs, fallFraction, grade, hit, isWin, leadInMs, multiplier, newGame, start, GRADE_RANK, type Level, type RState, type TrackId } from './rhythm/rules'
import './rhythm/rhythm.css'

const MAX_FRAME_MS = 100
const KEYS = ['d', 'f', 'j', 'k']
const OFFSET_KEY = 'govibearcadia.rhythm.offset'
const readOffset = () => {
  try {
    const v = Number(localStorage.getItem(OFFSET_KEY))
    return Number.isFinite(v) ? Math.max(-150, Math.min(150, Math.round(v))) : 0
  } catch {
    return 0
  }
}

export function RhythmMaster({ onFinish, seed }: GameProps) {
  const chartSeed = seed ?? 'rhythm'
  const [trackId, setTrackId] = useState<TrackId>('drift')
  const [level, setLevel] = useState<Level>('normal')
  const [offset, setOffsetState] = useState(readOffset)
  const [game, setGameState] = useState<RState>(() => newGame('drift', 'normal', chartSeed))
  const [paused, setPaused] = useState(false)
  const [down, setDown] = useState<number | null>(null)
  const current = useRef(game)
  /** Song time in ms, advanced by frames; `frameAt` is the performance.now() of the last frame, so presses get a time between frames. */
  const clock = useRef(0)
  const frameAt = useRef(0)
  const offsetRef = useRef(offset)
  const lastBeat = useRef(-1)
  const reported = useRef(false)
  const over = game.status === 'over'
  const running = game.status === 'playing' && !paused

  const setGame = useCallback((next: RState) => {
    current.current = next
    setGameState(next)
  }, [])

  const setOffset = (v: number) => {
    offsetRef.current = v
    setOffsetState(v)
    try {
      localStorage.setItem(OFFSET_KEY, String(v))
    } catch {
      /* not remembered */
    }
  }

  const report = useCallback(
    (s: RState) => {
      if (reported.current) return
      reported.current = true
      const total = s.notes.length
      onFinish({
        score: s.score,
        durationMs: Math.round(clock.current),
        won: isWin(s),
        stats: { perfect: s.perfect, good: s.good, miss: s.miss, maxCombo: s.maxCombo, notes: total, accuracy: Math.round(accuracy(s) * 100), grade: GRADE_RANK[grade(s)] },
      })
    },
    [onFinish],
  )

  useEffect(() => {
    if (!running) return
    let raf = 0
    let last = -1
    const frame = (t: number) => {
      if (last >= 0) clock.current += Math.min(t - last, MAX_FRAME_MS)
      last = t
      frameAt.current = performance.now()
      const before = current.current
      const s = advance(before, clock.current)
      const beat = Math.floor((clock.current - leadInMs(TRACKS[s.trackId])) / beatMs(TRACKS[s.trackId]))
      if (beat > lastBeat.current) {
        lastBeat.current = beat
        playBeat(s.trackId, beat)
      }
      if (s.miss > before.miss) playJudge('miss', 0)
      setGame(s)
      if (s.status === 'over') report(s)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running, report, setGame])

  const begin = useCallback(() => {
    if (current.current.status !== 'ready') return
    clock.current = 0
    lastBeat.current = -1
    frameAt.current = performance.now()
    setGame(start(current.current))
  }, [setGame])
  const togglePause = useCallback(() => {
    if (current.current.status === 'playing') setPaused((p) => !p)
  }, [])

  /** A press in a lane. The time is where the song is now (last frame plus what has passed since), shifted by the calibration offset. */
  const press = useCallback(
    (lane: number) => {
      const s = current.current
      if (s.status !== 'playing' || paused) return
      const t = clock.current + Math.min(performance.now() - frameAt.current, MAX_FRAME_MS) - offsetRef.current
      const next = hit(s, lane, t)
      if (next !== s) {
        setGame(next)
        if (next.last) playJudge(next.last.judgement, lane)
      }
    },
    [paused, setGame],
  )

  useEffect(() => {
    const onHide = () => {
      if (document.hidden && current.current.status === 'playing') setPaused(true)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      const lane = KEYS.indexOf(k)
      if (lane >= 0) {
        if ((e.target as HTMLElement | null)?.closest?.('input,select,textarea')) return
        e.preventDefault()
        if (e.repeat) return
        setDown(lane)
        press(lane)
      } else if (k === 'p' || k === 'escape') togglePause()
      else if (k === ' ' || k === 'enter') {
        if ((e.target as HTMLElement | null)?.closest?.('button,input,select')) return
        if (current.current.status === 'ready') {
          e.preventDefault()
          begin()
        }
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (KEYS.indexOf(e.key.toLowerCase()) >= 0) setDown(null)
    }
    addEventListener('keydown', onDown)
    addEventListener('keyup', onUp)
    return () => {
      removeEventListener('keydown', onDown)
      removeEventListener('keyup', onUp)
    }
  }, [press, begin, togglePause])

  const restart = (t: TrackId = trackId, l: Level = level) => {
    // A run abandoned with points still counts once, like the other games.
    if (current.current.status !== 'ready' && current.current.score > 0) report(current.current)
    reported.current = false
    clock.current = 0
    lastBeat.current = -1
    setPaused(false)
    setTrackId(t)
    setLevel(l)
    setGame(newGame(t, l, chartSeed))
  }

  const track = TRACKS[trackId]
  const fall = LEVELS[level].fallMs
  const beatNow = game.status === 'playing' ? Math.floor((game.now - leadInMs(track)) / beatMs(track)) : -1
  const pulse = game.status === 'playing' && (((game.now - leadInMs(track)) % beatMs(track)) + beatMs(track)) % beatMs(track) < 110
  const mult = multiplier(game.combo)

  return (
    <div className="rm">
      <div className="game-toolbar rm-bar">
        <div><small>Score</small><strong>{game.score}</strong></div>
        <div><small>Combo</small><strong>{game.combo}{mult > 1 ? ` ×${mult}` : ''}</strong></div>
        <span className="rm-beat" data-on={pulse || undefined} data-beat={beatNow >= 0 ? beatNow % 4 : undefined} aria-label="Metronome" role="img" />
        <button onClick={togglePause} disabled={game.status !== 'playing'} aria-label={paused ? 'Resume' : 'Pause'}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
        <button onClick={() => restart()} aria-label="New game"><RotateCcw size={15} /></button>
      </div>
      <div className="rm-field" role="group" aria-label={`${track.name}, ${LEVELS[level].label}`} data-status={paused && game.status === 'playing' ? 'paused' : game.status} data-score={game.score} data-combo={game.combo} data-perfect={game.perfect} data-good={game.good} data-miss={game.miss} data-notes={game.notes.length}>
        {Array.from({ length: LANES }, (_, lane) => (
          <button
            key={lane}
            type="button"
            className="rm-lane"
            data-lane={lane}
            data-down={down === lane || undefined}
            aria-label={`Lane ${KEYS[lane].toUpperCase()}`}
            onPointerDown={(e) => {
              e.preventDefault()
              press(lane)
            }}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') e.stopPropagation()
            }}
          >
            {game.status === 'playing'
              ? game.notes.map((n, i) => {
                  if (n.lane !== lane || n.result) return null
                  const f = fallFraction(n.t, game.now, fall)
                  if (f < -0.05 || f > 1.15) return null
                  return <span key={i} className="rm-note" style={{ top: `${f * 84}%` }} />
                })
              : null}
            <span className="rm-key" aria-hidden="true">{KEYS[lane].toUpperCase()}</span>
          </button>
        ))}
        <div className="rm-line" aria-hidden="true" />
        {game.last && game.status === 'playing' ? <div key={game.last.at + game.last.judgement + game.last.lane} className="rm-judge" data-j={game.last.judgement}>{game.last.judgement === 'perfect' ? 'Perfect' : game.last.judgement === 'good' ? 'Good' : 'Miss'}</div> : null}
        {game.status === 'ready' ? (
          <div className="rm-hint">
            <label>Track<select aria-label="Track" value={trackId} onChange={(e) => restart(e.target.value as TrackId, level)}>{TRACK_IDS.map((id) => <option key={id} value={id}>{TRACKS[id].name} · {TRACKS[id].bpm} bpm</option>)}</select></label>
            <label>Difficulty<select aria-label="Difficulty" value={level} onChange={(e) => restart(trackId, e.target.value as Level)}>{(Object.keys(LEVELS) as Level[]).map((l) => <option key={l} value={l}>{LEVELS[l].label}</option>)}</select></label>
            <label>Timing offset<input type="range" min={-150} max={150} step={5} value={offset} aria-label="Timing offset" onChange={(e) => setOffset(Number(e.target.value))} /><span>{offset > 0 ? '+' : ''}{offset} ms</span></label>
            <span>Press D F J K or tap a lane as notes reach the line. Sound is optional: the flashing dot keeps the beat.</span>
            <button className="primary-btn" onClick={begin}>Start</button>
          </div>
        ) : null}
        {paused && game.status === 'playing' ? <div className="rm-hint">Paused</div> : null}
      </div>
      <p className="game-help">Hit each note as it crosses the line. Perfect is within 45 ms, good within 110 ms. Ten in a row raises the multiplier, up to ×4. If hits feel early or late, adjust the timing offset. P or Escape pauses.</p>
      {over ? (
        <div className="game-over">
          <h3>Grade {grade(game)}</h3>
          <p>{game.score} points · {Math.round(accuracy(game) * 100)}% accuracy · best combo {game.maxCombo}</p>
          <p>{game.perfect} perfect · {game.good} good · {game.miss} missed</p>
          <button className="primary-btn" onClick={() => restart()}>Play again</button>
        </div>
      ) : null}
    </div>
  )
}
