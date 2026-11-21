import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { History, Pause, Play, Plus, RotateCcw } from 'lucide-react'
import { COMPUTER_PLAYERS, computerLabel } from '../lib/computerPlayers'
import { createRandom } from '../lib/rng'
import { playSound } from '../lib/sound'
import type { GameProps } from '../types'
import {
  DEFAULT_RULES, SUITS, SUIT_NAMES, TARGETS, aiMove, applyMove, canDraw, finishRound, handPoints, isEight, isOver, legalPlays, nextRound, play, rankLabel, spokenName, startMatch, suitOf, topCard,
  type Level, type Match, type Rules, type Suit,
} from './crazyeights/rules'
import './crazyeights/crazyeights.css'

/** Pause before the computer acts, so the player can follow. */
const THINK_MS = 750
const LEVELS: [Level, string][] = [['beginner', 'Beginner'], ['normal', 'Normal'], ['advanced', 'Advanced']]
const ANIM_KEY = 'govibearcadia.ce.anim'

type Config = { players: number; humans: number; level: Level; target: number; rules: Rules }
const DEFAULT_CONFIG: Config = { players: 2, humans: 1, level: 'normal', target: 100, rules: DEFAULT_RULES }

const readAnim = (): boolean => {
  try {
    const v = localStorage.getItem(ANIM_KEY)
    if (v) return v === 'on'
  } catch { /* not remembered */ }
  return !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
}

function Face({ id, onClick, disabled, hotkey, fresh, index }: { id: number; onClick?: () => void; disabled?: boolean; hotkey?: number; fresh?: boolean; index?: number }) {
  const red = suitOf(id) === 1 || suitOf(id) === 2
  const body = <><b>{rankLabel(id)}</b><span aria-hidden="true">{SUITS[suitOf(id)]}</span></>
  const style = index === undefined ? undefined : ({ '--i': index } as React.CSSProperties)
  if (!onClick) return <div className="ce-card" data-red={red || undefined} data-fresh={fresh || undefined} role="img" aria-label={spokenName(id)}>{body}</div>
  return (
    <button className="ce-card" style={style} data-red={red || undefined} data-card={id} data-fresh={fresh || undefined} data-ok={!disabled || undefined} disabled={disabled}
      aria-label={`${spokenName(id)}${disabled ? '' : ', playable'}${hotkey ? `, key ${hotkey % 10}` : ''}`} onClick={onClick}>{body}</button>
  )
}

export function CrazyEights({ onFinish, seed }: GameProps) {
  const base = seed ?? 'crazy-eights'
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [draft, setDraft] = useState<Config>(DEFAULT_CONFIG)
  const [screen, setScreen] = useState<'game' | 'setup'>('game')
  const [run, setRun] = useState(0)
  const [match, setMatch] = useState<Match>(() => startMatch(`${base}:0`, DEFAULT_CONFIG.players, DEFAULT_CONFIG.humans, DEFAULT_CONFIG.rules, DEFAULT_CONFIG.target))
  const [paused, setPaused] = useState(false)
  const [eight, setEight] = useState<number | null>(null)
  const [revealed, setRevealed] = useState<number | null>(null)
  const [showRounds, setShowRounds] = useState(false)
  const [anim, setAnim] = useState(readAnim)
  const [drawn, setDrawn] = useState<number | null>(null)
  const startedAt = useRef(0)
  const reported = useRef(false)
  const random = useMemo(() => createRandom(`${base}:${run}:ai`), [base, run])
  const round = match.round
  const humans = match.humans
  const turn = round.turn
  const isHuman = (seat: number) => seat < humans
  const hot = humans > 1

  const nameOf = useCallback((seat: number) => (seat >= humans ? computerLabel(COMPUTER_PLAYERS[(seat - humans) % COMPUTER_PLAYERS.length]) : humans === 1 ? 'You' : `Player ${seat + 1}`), [humans])
  const over = isOver(round)

  const commit = useCallback(
    (next: Match['round'], card?: number) => {
      let m: Match = { ...match, round: next }
      if (next.winner !== null) m = finishRound(m)
      setMatch(m)
      setEight(null)
      setRevealed(null)
      setDrawn(card ?? null)
      if (m.over && !reported.current) {
        reported.current = true
        playSound(m.winner === 0 ? 'win' : 'lose')
        // A match shared by several people on one device is not scored for the arcade.
        if (m.humans === 1) {
          onFinish({
            score: m.scores[0],
            durationMs: Date.now() - startedAt.current,
            won: m.winner === 0,
            stats: { rounds: m.history.length, roundsWon: m.history.filter((h) => h.winner === 0).length, players: m.players, target: m.target, level: ['beginner', 'normal', 'advanced'].indexOf(config.level) + 1 },
          })
        }
      }
    },
    [match, onFinish, config.level],
  )

  // The computer's turn, on a short delay so each move can be followed.
  useEffect(() => {
    if (screen !== 'game' || paused || over || isHuman(turn)) return
    const timer = setTimeout(() => {
      const before = round.hands[turn].length
      const next = applyMove(round, aiMove(round, config.level, random))
      playSound(next.hands[turn].length < before ? 'tap' : 'move')
      commit(next)
    }, THINK_MS)
    return () => clearTimeout(timer)
  })

  const myHandSeat = hot ? (isHuman(turn) && revealed === turn ? turn : null) : 0
  const hand = myHandSeat === null ? [] : round.hands[myHandSeat]
  const myTurn = !over && !paused && isHuman(turn) && (hot ? revealed === turn : true)
  const legal = useMemo(() => new Set(myTurn ? legalPlays(round) : []), [round, myTurn])
  const mustDraw = myTurn && legal.size === 0 && canDraw(round)

  const begin = () => {
    if (!startedAt.current) startedAt.current = Date.now()
  }
  const pick = useCallback(
    (card: number) => {
      if (!myTurn || !legal.has(card)) return
      begin()
      if (isEight(card)) return setEight(card)
      playSound('tap')
      commit(play(round, card), undefined)
    },
    [myTurn, legal, round, commit],
  )
  const choose = useCallback(
    (suit: Suit) => {
      if (eight === null) return
      begin()
      playSound('tap')
      commit(play(round, eight, suit))
    },
    [eight, round, commit],
  )
  const drawCard = useCallback(() => {
    if (!mustDraw) return
    begin()
    const before = round.hands[turn]
    const next = applyMove(round, { kind: 'draw' })
    const got = next.hands[turn].find((c) => !before.includes(c))
    playSound('move')
    commit(next, got)
  }, [mustDraw, round, turn, commit])

  const togglePause = useCallback(() => {
    if (screen === 'game' && !over) setPaused((p) => !p)
  }, [screen, over])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || screen !== 'game') return
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        if (eight !== null) setEight(null)
        else if (showRounds) setShowRounds(false)
        else togglePause()
        return
      }
      if (k === 'p') return togglePause()
      if (eight !== null) {
        const s = ['s', 'h', 'd', 'c'].indexOf(k)
        if (s >= 0) choose(s as Suit)
        return
      }
      if (k === 'd') return drawCard()
      const n = k === '0' ? 10 : Number(k)
      if (Number.isInteger(n) && n >= 1 && n <= hand.length) pick(hand[n - 1])
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const begun = (cfg: Config) => {
    const next = run + 1
    reported.current = false
    startedAt.current = 0
    setRun(next)
    setConfig(cfg)
    setMatch(startMatch(`${base}:${next}`, cfg.players, cfg.humans, cfg.rules, cfg.target))
    setPaused(false)
    setEight(null)
    setRevealed(null)
    setDrawn(null)
    setShowRounds(false)
    setScreen('game')
  }
  const toggleAnim = () => {
    setAnim((a) => {
      try { localStorage.setItem(ANIM_KEY, a ? 'off' : 'on') } catch { /* not remembered */ }
      return !a
    })
  }

  const status = (() => {
    if (match.over) return match.winner === 0 && humans === 1 ? 'You win the match!' : `${nameOf(match.winner as number)} wins the match`
    if (over) return round.winner === 0 && humans === 1 ? 'You win the round!' : `${nameOf(round.winner as number)} wins the round`
    if (paused) return 'Paused'
    if (!isHuman(turn)) return `${nameOf(turn)} is thinking…`
    if (hot && revealed !== turn) return `Pass the device to ${nameOf(turn)}`
    if (eight !== null) return 'Choose a suit'
    if (mustDraw) return round.rules.drawRule === 'until' ? 'No play: draw until you can play' : 'No play: draw a card'
    if (legal.size === 0) return 'Nothing to play or draw: pass'
    return humans === 1 ? 'Your turn' : `${nameOf(turn)}: your turn`
  })()
  const top = topCard(round)

  if (screen === 'setup')
    return (
      <div className="ce">
        <div className="game-toolbar c4-bar"><div><small>Crazy Eights</small><strong className="c4-status">New game</strong></div></div>
        <form className="ce-setup" onSubmit={(e) => { e.preventDefault(); begun(draft) }}>
          <label>Players<select value={draft.players} onChange={(e) => { const players = Number(e.target.value); setDraft({ ...draft, players, humans: Math.min(draft.humans, players) }) }}>{[2, 3, 4].map((n) => <option key={n} value={n}>{n} players</option>)}</select></label>
          <label>Humans on this device<select value={draft.humans} onChange={(e) => setDraft({ ...draft, humans: Number(e.target.value) })}>{Array.from({ length: draft.players }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? '1 (the rest are computers)' : `${n} (pass and play)`}</option>)}</select></label>
          <label>Computer level<select value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value as Level })}>{LEVELS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
          <label>Play to<select value={draft.target} onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })}>{TARGETS.map((n) => <option key={n} value={n}>{n} points</option>)}</select></label>
          <fieldset>
            <legend>House rules</legend>
            <label>When you cannot play<select value={draft.rules.drawRule} onChange={(e) => setDraft({ ...draft, rules: { ...draft.rules, drawRule: e.target.value as Rules['drawRule'] } })}><option value="until">Draw until you can play</option><option value="one">Draw one card, then pass if stuck</option></select></label>
            <label className="ce-check"><input type="checkbox" checked={draft.rules.noEightFinish} onChange={(e) => setDraft({ ...draft, rules: { ...draft.rules, noEightFinish: e.target.checked } })} />You cannot go out with an eight</label>
          </fieldset>
          <div className="ce-actions"><button type="submit" className="primary-btn">Start game</button><button type="button" onClick={() => setScreen('game')}>Back</button></div>
        </form>
      </div>
    )

  return (
    <div className="ce" data-anim={anim ? 'on' : 'off'}>
      <div className="game-toolbar c4-bar">
        <div><small>{match.players} players · first to {match.target}</small><strong className="c4-status" aria-live="polite">{status}</strong></div>
        <div className="ce-btns">
          <button onClick={togglePause} disabled={over} aria-label={paused ? 'Resume' : 'Pause'}>{paused ? <Play size={15} /> : <Pause size={15} />}{paused ? 'Resume' : 'Pause'}</button>
          <button onClick={() => { setDraft(config); setScreen('setup') }}><Plus size={15} />New game</button>
          <button onClick={() => begun(config)}><RotateCcw size={15} />Restart</button>
        </div>
      </div>
      <div className="ce-score" aria-label="Scores">
        {match.scores.map((n, i) => <span key={i} data-turn={!over && turn === i ? true : undefined}>{nameOf(i)} <b>{n}</b></span>)}
        <button className="ce-link" onClick={() => setShowRounds(true)} aria-label="Match history"><History size={14} />Rounds {match.history.length}</button>
      </div>
      <div className="ce-felt" key={`${run}:${match.history.length}`}>
        <div className="ce-opps">
          {round.hands.map((h, i) => (!hot && i === 0 ? null : (
            <div key={i} className="ce-seat" data-turn={!over && turn === i ? true : undefined} aria-label={`${nameOf(i)}, ${h.length} cards`}>
              <span>{nameOf(i)}</span>
              <span className="ce-fan" aria-hidden="true">{Array.from({ length: Math.min(h.length, 6) }, (_, k) => <i key={k} style={{ '--i': k } as React.CSSProperties} />)}</span>
              <b>{h.length}</b>
            </div>
          )))}
        </div>
        <div className="ce-centre">
          <button className="ce-stock" onClick={drawCard} disabled={!mustDraw} aria-label={`Draw a card, ${round.stock.length + Math.max(0, round.discard.length - 1)} left`}>
            <span aria-hidden="true">Draw</span><b>{round.stock.length}</b>
          </button>
          <div className="ce-pile" key={top}><Face id={top} fresh /></div>
          <div className="ce-suit" data-red={round.suit === 1 || round.suit === 2 || undefined} aria-label={`Suit to match: ${SUIT_NAMES[round.suit]}`}><span aria-hidden="true">{SUITS[round.suit]}</span><small>{SUIT_NAMES[round.suit]}</small></div>
        </div>
        {eight !== null ? (
          <div className="ce-choose" role="group" aria-label="Choose a suit for your eight">
            {([0, 1, 2, 3] as Suit[]).map((s) => <button key={s} data-red={s === 1 || s === 2 || undefined} onClick={() => choose(s)} aria-label={`Choose ${SUIT_NAMES[s]}`}>{SUITS[s]}<small>{SUIT_NAMES[s]}</small></button>)}
            <button onClick={() => setEight(null)}>Cancel</button>
          </div>
        ) : <p className="ce-note" aria-live="polite">{round.note ? `${nameOf((round.turn + round.players - 1) % round.players)} ${round.note}` : `${nameOf(0)} ${humans === 1 ? 'go' : 'goes'} first`}</p>}
        {hot && isHuman(turn) && revealed !== turn && !over ? (
          <div className="ce-hand ce-cover"><button className="primary-btn" onClick={() => setRevealed(turn)}>Show {nameOf(turn)}'s hand</button></div>
        ) : (
          <div className="ce-hand" key={`deal:${run}:${match.history.length}`} aria-label={myHandSeat === null ? 'Hand hidden' : `${nameOf(myHandSeat)}'s hand, ${hand.length} cards`}>
            {hand.map((c, i) => <Face key={c} id={c} index={i} onClick={() => pick(c)} disabled={!legal.has(c)} hotkey={i < 10 ? i + 1 : undefined} fresh={c === drawn} />)}
          </div>
        )}
        {paused ? <div className="ce-overlay"><strong>Paused</strong><button className="primary-btn" onClick={togglePause}>Resume</button></div> : null}
        {showRounds ? (
          <div className="ce-overlay" role="dialog" aria-label="Match history">
            <strong>Match history</strong>
            {match.history.length === 0 ? <p>No rounds finished yet.</p> : (
              <ol className="ce-rounds">{match.history.map((h) => <li key={h.round}>Round {h.round}: {nameOf(h.winner)} {h.blocked ? 'won a blocked round with' : 'went out for'} {h.points} points</li>)}</ol>
            )}
            <button onClick={() => setShowRounds(false)}>Close</button>
          </div>
        ) : null}
        {over && !showRounds ? (
          <div className="ce-overlay" role="dialog" aria-label={match.over ? 'Match over' : 'Round over'}>
            <strong>{status}</strong>
            <p>{round.blocked ? 'The round was blocked. ' : ''}{nameOf(round.winner as number)} scores {match.history[match.history.length - 1]?.points ?? 0} points{!round.blocked ? ` (${round.hands.map((h, i) => (i === round.winner ? null : `${nameOf(i)} ${handPoints(h)}`)).filter(Boolean).join(', ')} left in hand)` : ''}.</p>
            <p className="ce-totals">{match.scores.map((n, i) => `${nameOf(i)} ${n}`).join(' · ')}</p>
            {match.over ? <button className="primary-btn" onClick={() => begun(config)}>Play again</button> : <button className="primary-btn" onClick={() => setMatch(nextRound(match))}>Next round</button>}
          </div>
        ) : null}
      </div>
      <div className="ce-opts"><label className="ce-check"><input type="checkbox" checked={anim} onChange={toggleAnim} />Animations</label><span>Keys: 1–9 play a card, D draw, P pause</span></div>
    </div>
  )
}
