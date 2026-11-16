import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { TICK_MS, advance, newGame, play, rankOf, scoreFor, slap, suitOf, type Level, type RState } from './slappile/rules'
import './slappile/slappile.css'

const LEVELS: [Level, string][] = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]
const COLOURS = ['#d9a21b', '#c62832', '#2b5fc4', '#2f8f4a']
const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUITS = ['coins', 'cups', 'swords', 'clubs']
const label = (id: number) => `${RANKS[rankOf(id)]} of ${SUITS[suitOf(id)]}`

export function SlapPile({ onFinish, seed }: GameProps) {
  const base = seed ?? 'slap-pile'
  const [opponents, setOpponents] = useState<1 | 2 | 3>(1)
  const [level, setLevel] = useState<Level>('normal')
  const [round, setRound] = useState(0)
  const [paused, setPaused] = useState(false)
  const [, setVersion] = useState(0)
  const stateRef = useRef<RState>(newGame(1, 'normal', `${base}:0`))
  const rngRef = useRef(createRandom(`${base}:0:ai`))
  const startRef = useRef(Date.now())
  const reported = useRef(false)
  const pausedRef = useRef(false)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const commit = useCallback((next: RState) => {
    if (next === stateRef.current) return
    stateRef.current = next
    if (next.over && !reported.current) {
      reported.current = true
      onFinishRef.current({
        score: scoreFor(next),
        durationMs: Date.now() - startRef.current,
        won: next.winner === 0,
        stats: { opponents: next.n - 1, plays: next.plays, goodSlaps: next.goodSlaps, badSlaps: next.badSlaps, cardsLeft: next.hands[0].length },
      })
    }
    setVersion((v) => v + 1)
  }, [])

  const start = useCallback((opp: 1 | 2 | 3, lv: Level, r: number) => {
    const key = `${base}:${r}`
    stateRef.current = newGame(opp, lv, key)
    rngRef.current = createRandom(`${key}:ai`)
    reported.current = false
    startRef.current = Date.now()
    pausedRef.current = false
    setPaused(false)
    setVersion((v) => v + 1)
  }, [base])

  const restart = (opp = opponents, lv = level) => {
    const r = round + 1
    setRound(r)
    start(opp, lv, r)
  }

  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current || stateRef.current.over) return
      commit(advance(stateRef.current, TICK_MS, rngRef.current))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [commit])

  const setPause = useCallback((p: boolean) => {
    if (stateRef.current.over) return
    pausedRef.current = p
    setPaused(p)
  }, [])

  const doPlay = useCallback(() => {
    if (!pausedRef.current) commit(play(stateRef.current, 0, rngRef.current))
  }, [commit])
  const doSlap = useCallback(() => {
    if (!pausedRef.current) commit(slap(stateRef.current, 0, rngRef.current))
  }, [commit])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ['SELECT', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.key === ' ') { e.preventDefault(); doSlap() }
      else if (e.key === 'Enter') { e.preventDefault(); doPlay() }
      else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') setPause(!pausedRef.current)
    }
    const onVis = () => { if (document.hidden) setPause(true) }
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [doPlay, doSlap, setPause])

  const s = stateRef.current
  const top = s.pile[s.pile.length - 1]
  const myTurn = s.turn === 0 && !s.over
  const flash = s.lastSlap ? `${s.lastSlap.id}-${s.lastSlap.ok ? 'ok' : 'bad'}` : undefined

  return (
    <div className="sp">
      <div className="sp-opts">
        <label>Opponents
          <select value={opponents} onChange={(e) => { const v = Number(e.target.value) as 1 | 2 | 3; setOpponents(v); restart(v, level) }}>
            <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
          </select>
        </label>
        <label>Level
          <select value={level} onChange={(e) => { const v = e.target.value as Level; setLevel(v); restart(opponents, v) }}>
            {LEVELS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <button className="sp-small" onClick={() => setPause(!paused)} aria-label={paused ? 'Resume' : 'Pause'} disabled={s.over}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
        <button className="sp-small" onClick={() => restart()} aria-label="New game"><RotateCcw size={16} /></button>
      </div>
      <div className="sp-felt" data-flash={flash}>
        <div className="sp-hands">
          {s.hands.map((h, i) => (
            <div key={i} className="sp-hand" data-turn={s.turn === i && !s.over ? '' : undefined} data-out={h.length === 0 ? '' : undefined}>
              <span>{i === 0 ? 'You' : s.n === 2 ? 'Computer' : `Computer ${i}`}</span>
              <b data-testid={`sp-count-${i}`}>{h.length}</b>
            </div>
          ))}
        </div>
        <div className="sp-pile" aria-live="polite">
          {top === undefined ? <div className="sp-empty">Pile is empty</div> : (
            <div className="sp-card" data-card={top} role="img" aria-label={label(top)}>
              <span>{RANKS[rankOf(top)]}</span>
              <i style={{ background: COLOURS[suitOf(top)] }} />
            </div>
          )}
          <small data-testid="sp-pile-size">{s.pile.length} in pile</small>
        </div>
        <p className="sp-note" role="status">{s.note}{s.challenge && !s.over ? ` (${s.challenge.remaining} left)` : ''}</p>
        <div className="sp-actions">
          <button className="sp-deck" onClick={(e) => { e.stopPropagation(); doPlay() }} disabled={!myTurn || paused} data-testid="sp-play">Deck</button>
          <button className="sp-slap" onClick={(e) => { e.stopPropagation(); doSlap() }} disabled={s.over || paused || s.hands[0].length === 0} data-testid="sp-slap">Slap</button>
        </div>
        {paused ? <div className="sp-over" role="status">Paused <button onClick={() => setPause(false)}>Resume</button></div> : null}
        {s.over ? (
          <div className="sp-over" role="status" data-testid="sp-over">
            {s.capped ? 'Game called' : s.winner === 0 ? 'You win!' : 'You lose'}
            <small>Score {scoreFor(s)}</small>
            <button onClick={() => restart()}>Play again</button>
          </div>
        ) : null}
      </div>
      <p className="game-help">Press Enter or tap Deck to play your top card. Slap with Space or the Slap button when the top card matches the one under it (a pair) or the one two under it (a sandwich). A wrong slap burns a card. Play a jack, queen, king or ace and the next player gets 1, 2, 3 or 4 tries to answer with a face card, or you take the pile. P pauses. Win by holding every card.</p>
    </div>
  )
}
