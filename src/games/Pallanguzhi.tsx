import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw, Undo2 } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { LEVELS, choosePit, type Level } from './pallanguzhi/ai'
import { SEED_OPTIONS, SOWING_OPTIONS, describeConfig, isDefaultConfig, seedsNote } from './pallanguzhi/config'
import {
  PITS, apply, fillable, legalPits, newGame, ownerOf, rowOf,
  type Config, type GameEvent, type Player, type State, type Step,
} from './pallanguzhi/rules'
import {
  DEFAULT_SETTINGS, clearSaved, loadRules, loadSaved, loadSettings, save, saveRules, saveSettings,
  type Mode, type Settings, type Speed,
} from './pallanguzhi/save'
import { TUTORIAL, stepStart } from './pallanguzhi/tutorial'

type View = 'local' | 'computer' | 'tutorial'

const DELAY: Record<Speed, number> = { slow: 420, normal: 230, fast: 90, instant: 0 }
const NAMES: [string, string] = ['Player 1', 'Player 2']
const COMPUTER_MS = 520

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
/** Pits are numbered 1 to 7 from each player's left, which is how they read on screen. */
const label = (pit: number) => (pit < 7 ? pit + 1 : 14 - pit)

function describe(events: GameEvent[], names: [string, string]): string {
  const parts = events.map((e) => {
    switch (e.type) {
      case 'sow': return `${names[e.player]} sowed ${plural(e.seeds, 'seed')} from pit ${label(e.pit)}`
      case 'relay': return `relayed on from pit ${label(e.pit)} (${plural(e.seeds, 'seed')})`
      case 'saada': return e.total > 0 ? `Saada at pit ${label(e.empty)}: captured ${plural(e.total, 'seed')}` : `Saada at pit ${label(e.empty)}: nothing to capture`
      case 'second-sowing': return `${names[e.player]} sows again`
      case 'pass': return `${names[e.player]} has no seeds and passes`
      case 'round-over': return `Round ${e.round} is over`
      case 'round-start': return `Round ${e.round}: ${names[e.first]} starts`
      case 'match-over': return e.winner === 'draw' ? 'The match is drawn' : `${names[e.winner]} wins the match`
    }
  })
  return parts.length ? `${parts.join('. ')}.` : ''
}

/** The board as it looks after the first `n` steps of a sowing. */
function viewAt(base: State, trace: Step[], n: number) {
  const pits = [...base.pits]
  let hand = 0
  let busy: number | null = null
  let saada: number | null = null
  let taken: number[] = []
  for (let i = 0; i < n; i++) {
    const t = trace[i]
    if (t.t === 'pick') {
      pits[t.pit] = 0
      hand = t.seeds
      busy = t.pit
      saada = null
    } else if (t.t === 'drop') {
      pits[t.pit]++
      hand--
      busy = t.pit
    } else {
      for (const c of t.captured) pits[c.pit] = 0
      taken = t.captured.map((c) => c.pit)
      saada = t.empty
      hand = 0
      busy = null
    }
  }
  return { pits, hand, busy, saada, taken }
}

/** Where each seed lies in a pit: a fixed scatter, so a pit looks the same every time it is drawn. */
const spot = (pit: number, k: number) => {
  const a = (k * 137.508 + pit * 31) * (Math.PI / 180)
  const r = 14 + ((k * 37 + pit * 11) % 26)
  return { x: 50 + Math.cos(a) * r, y: 50 + Math.sin(a) * r, rot: (k * 53 + pit * 19) % 180 }
}

const MAX_SEEDS_SHOWN = 16

function Seeds({ pit, count }: { pit: number; count: number }) {
  const shown = Math.min(count, MAX_SEEDS_SHOWN)
  return (
    <span className="pg-seeds" aria-hidden="true">
      {Array.from({ length: shown }, (_, k) => {
        const p = spot(pit, k)
        return <i key={k} style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%,-50%) rotate(${p.rot}deg)` }} />
      })}
    </span>
  )
}

let audio: AudioContext | null = null
function blip(freq: number, ms = 70) {
  try {
    audio ??= new AudioContext()
    const o = audio.createOscillator()
    const g = audio.createGain()
    o.frequency.value = freq
    g.gain.value = 0.04
    o.connect(g).connect(audio.destination)
    o.start()
    o.stop(audio.currentTime + ms / 1000)
  } catch {
    /* no audio available: the game is silent */
  }
}

type Anim = { base: State; next: State; trace: Step[]; i: number }

export function Pallanguzhi({ onFinish, seed }: GameProps) {
  const saved = useMemo(() => (seed === undefined ? loadSaved() : null), [seed])
  const [view, setView] = useState<View>(saved?.mode ?? 'computer')
  const [level, setLevel] = useState<Level>(saved?.level ?? 'medium')
  const [rules, setRules] = useState<Config>(() => saved?.state.config ?? loadRules())
  const [rulesOpen, setRulesOpen] = useState(false)
  const [game, setGame] = useState<State>(() => saved?.state ?? newGame(rules))
  const [history, setHistory] = useState<State[]>(saved?.history ?? [])
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [anim, setAnim] = useState<Anim | null>(null)
  const [note, setNote] = useState(saved ? 'Welcome back: your saved match was restored.' : '')
  const [step, setStep] = useState(0)
  const [stepDone, setStepDone] = useState(false)
  const [focusPit, setFocusPit] = useState<number | null>(null)
  const reported = useRef(false)
  const startedAt = useRef(Date.now())
  const random = useMemo(() => createRandom(seed ?? `pg-${Date.now()}`), [seed])
  const pitRefs = useRef<(HTMLButtonElement | null)[]>([])

  const tutorial = view === 'tutorial'
  const vsComputer = view === 'computer'
  const names: [string, string] = vsComputer ? ['You', `Computer (${level})`] : NAMES
  const delay = settings.reduceMotion ? 0 : DELAY[settings.speed]
  const step0 = TUTORIAL[step]

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
  }

  // Everything a finished action changes, in one place. A run is reported once, from the handler or timer that ends it.
  const settle = useCallback(
    (next: State, from: State) => {
      setGame(next)
      setNote(describe(next.events, names))
      if (!tutorial && next.phase === 'over' && !reported.current) {
        reported.current = true
        const winner = next.winner
        const won = vsComputer ? winner === 0 : winner !== 'draw'
        onFinish({
          score: next.stores[0] * 10 + (next.round - 1) * 20 + (won ? 500 : 0),
          durationMs: Date.now() - startedAt.current,
          won,
          stats: { rounds: next.round, vsComputer: vsComputer ? 1 : 0, level: vsComputer ? LEVELS.indexOf(level) + 1 : 0, winner: winner === 'draw' || winner === null ? 2 : winner, captured: next.stores[0] },
        })
        clearSaved()
      }
      if (settings.sound && from !== next) blip(next.stores[next.turn] > from.stores[next.turn] ? 660 : 330, 90)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onFinish, tutorial, vsComputer, level, settings.sound, names[1]],
  )

  const sow = useCallback(
    (pit: number) => {
      if (anim) return
      const r = apply(game, { type: 'sow', pit })
      if (!r.ok) return
      if (!tutorial) setHistory((h) => [...h.slice(-199), game])
      setFocusPit(null)
      if (delay === 0) settle(r.state, game)
      else setAnim({ base: game, next: r.state, trace: r.trace, i: 0 })
    },
    [anim, game, delay, settle, tutorial],
  )

  // Plays a sowing one step at a time, so every seed can be followed.
  useEffect(() => {
    if (!anim) return
    const t = anim.trace[anim.i]
    const wait = !t ? delay : t.t === 'pick' ? delay * 1.6 : t.t === 'saada' ? delay * 3 : delay
    const timer = setTimeout(() => {
      if (anim.i >= anim.trace.length) {
        setAnim(null)
        settle(anim.next, anim.base)
      } else {
        if (settings.sound && t?.t === 'drop') blip(220 + (anim.i % 8) * 18, 40)
        setAnim({ ...anim, i: anim.i + 1 })
      }
    }, wait)
    return () => clearTimeout(timer)
  }, [anim, delay, settle, settings.sound])

  // The computer's turn.
  useEffect(() => {
    if (!vsComputer || anim || game.phase !== 'play' || game.turn !== 1) return
    const timer = setTimeout(
      () => {
        const pit = choosePit(game, level, random)
        if (pit !== undefined) sow(pit)
      },
      delay === 0 ? 60 : COMPUTER_MS,
    )
    return () => clearTimeout(timer)
  }, [vsComputer, anim, game, level, random, sow, delay])

  // Keep a match in progress, so it can be resumed later.
  useEffect(() => {
    if (tutorial || seed !== undefined) return
    if (game.phase === 'over') clearSaved()
    else save({ v: 1, mode: view as Mode, level, state: game, history: history.slice(-60) })
  }, [tutorial, seed, game, view, level, history])

  const freshMatch = (nextView: View = view, nextLevel: Level = level, nextRules: Config = rules) => {
    setView(nextView)
    setLevel(nextLevel)
    setAnim(null)
    setHistory([])
    setStep(0)
    setStepDone(false)
    setNote('')
    reported.current = false
    startedAt.current = Date.now()
    if (nextView === 'tutorial') setGame(stepStart(TUTORIAL[0], newGame()))
    else setGame(newGame(nextRules))
    clearSaved()
  }

  const goStep = (n: number) => {
    const next = Math.max(0, Math.min(TUTORIAL.length - 1, n))
    setStep(next)
    setStepDone(false)
    setAnim(null)
    setNote('')
    setGame((g) => stepStart(TUTORIAL[next], g))
  }

  const undo = () => {
    if (anim || history.length === 0) return
    // Against the computer, step back to the last time it was your move.
    let i = history.length - 1
    if (vsComputer) while (i > 0 && history[i].turn !== 0) i--
    if (vsComputer && history[i].turn !== 0) return
    setGame(history[i])
    setHistory(history.slice(0, i))
    setNote('Move undone.')
    reported.current = false
  }

  const nextRound = () => {
    const r = apply(game, { type: 'next-round' })
    if (!r.ok) return
    setHistory((h) => [...h.slice(-199), game])
    settle(r.state, game)
  }

  const over = game.phase === 'over'
  const live = anim ? viewAt(anim.base, anim.trace, anim.i) : null
  const pits = live ? live.pits : game.pits
  const stores = anim && live && live.taken.length ? anim.next.stores : game.stores
  const legal = useMemo(() => legalPits(game), [game])
  const humanTurn = !over && game.phase === 'play' && !anim && (!vsComputer || game.turn === 0)
  const hint = tutorial && !stepDone && step0.expect !== undefined && game.phase === 'play' ? step0.expect : null

  const onPit = (pit: number) => {
    if (anim) return
    if (game.phase === 'round-over') return setNote('The round is over. Start the next round to continue.')
    if (over) return setNote('The match is over. Start a new match to play again.')
    if (vsComputer && game.turn === 1) return setNote('Wait for the computer to finish its turn.')
    if (ownerOf(pit) !== game.turn) return setNote(`That is ${names[ownerOf(pit)]}’s pit. It is ${names[game.turn]}’s turn: choose a pit in the ${game.turn === 0 ? 'bottom' : 'top'} row.`)
    if (!game.active[pit]) return setNote('That is a piggy pit: it could not be refilled, so it is out of play. Choose another pit.')
    if (pits[pit] === 0) return setNote('That pit is empty. Choose a pit with seeds.')
    if (tutorial) {
      if (stepDone || step0.expect === undefined) return setNote('Press Next to continue.')
      if (pit !== step0.expect) return setNote('Try the glowing pit for this lesson.')
      setStepDone(true)
    }
    sow(pit)
  }

  // Keys 1 to 7 choose a pit in your row, left to right as you see it; arrows move around the board.
  const onKeyDown = (e: globalThis.KeyboardEvent) => {
    if ((e.target as HTMLElement | null)?.closest?.('select,input,textarea')) return
    const n = Number(e.key)
    if (n >= 1 && n <= 7 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const row = game.turn === 0 ? rowOf(0) : [...rowOf(1)].reverse()
      onPit(row[n - 1])
      e.preventDefault()
      return
    }
    const here = pitRefs.current.findIndex((b) => b === document.activeElement)
    if (here < 0) return
    // Visual order: top row is pits 13..7, bottom row 0..6.
    const order = [...rowOf(1)].reverse().concat(rowOf(0))
    const at = order.indexOf(here)
    const move = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' || e.key === 'ArrowUp' ? 7 * (at < 7 ? 1 : -1) : 0
    if (!move) return
    e.preventDefault()
    const target = order[(at + move + 14) % 14]
    pitRefs.current[target]?.focus()
  }

  // Keys work from anywhere on the page, so they keep working after a menu has been used.
  const keys = useRef(onKeyDown)
  keys.current = onKeyDown
  useEffect(() => {
    const listener = (e: globalThis.KeyboardEvent) => keys.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const turnText = over
    ? game.winner === 'draw' ? 'Drawn match' : `${names[game.winner as Player]} wins`
    : game.phase === 'round-over'
      ? `Round ${game.round} over`
      : `${names[game.turn]}${vsComputer && game.turn === 1 ? ' is thinking' : ''}${game.sowings > 0 ? ': second sowing' : ''}`

  const rowsTopToBottom: number[][] = [[...rowOf(1)].reverse(), rowOf(0)]
  const pristine = history.length === 0 && !anim && game.round === 1 && game.sowings === 0 && game.phase === 'play'
  const chooseRules = (patch: Partial<Config>) => {
    const next = { ...rules, ...patch }
    setRules(next)
    saveRules(next)
    freshMatch(view, level, next)
  }
  const refillPlan = ([0, 1] as const).map((p) => fillable(game.stores[p], game.config))

  return (
    <div className="pg" data-contrast={settings.contrast || undefined} data-motion={delay === 0 ? 'off' : 'on'}>
      <div className="game-toolbar pg-bar">
        <div className="pg-settings">
          <label>
            <span className="sr-only">Mode</span>
            <select aria-label="Mode" value={view} onChange={(e) => { e.target.blur(); freshMatch(e.target.value as View) }}>
              <option value="computer">Play the computer</option>
              <option value="local">Two players, one device</option>
              <option value="tutorial">Tutorial</option>
            </select>
          </label>
          {vsComputer && (
            <label>
              <span className="sr-only">Difficulty</span>
              <select aria-label="Difficulty" value={level} onChange={(e) => { e.target.blur(); freshMatch('computer', e.target.value as Level) }}>
                {LEVELS.map((l) => <option key={l} value={l}>{l[0].toUpperCase() + l.slice(1)}</option>)}
              </select>
            </label>
          )}
          <label>
            <span className="sr-only">Animation speed</span>
            <select aria-label="Animation speed" value={settings.speed} onChange={(e) => { e.target.blur(); update({ speed: e.target.value as Speed }) }}>
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
              <option value="instant">Instant</option>
            </select>
          </label>
        </div>
        <div className="pg-buttons">
          <button type="button" onClick={undo} disabled={tutorial || !!anim || history.length === 0 || over} aria-label="Undo"><Undo2 size={16} />Undo</button>
          {!tutorial && <button type="button" onClick={() => setRulesOpen((o) => !o)} aria-expanded={rulesOpen} aria-controls="pg-rules">Rules</button>}
          <button type="button" onClick={() => freshMatch()} aria-label="New match"><RotateCcw size={16} />New</button>
        </div>
      </div>

      <div className="pg-status">
        <span className="pg-turn" data-player={game.turn} aria-hidden="true" />
        <strong>{turnText}</strong>
        <span className="pg-round">Round {game.round}{!tutorial && !isDefaultConfig(game.config) ? ' · custom rules' : ''}</span>
      </div>

      {rulesOpen && !tutorial && (
        <div className="pg-rules" id="pg-rules" role="dialog" aria-label="Rules for this match">
          <h3>Rules for this match</h3>
          <p className="pg-rules-note">{pristine ? 'Changing a rule starts a new match. Your choice is remembered for next time.' : 'Rules are locked while a match is in progress. Press New, then choose.'}</p>
          <label>Seeds in each pit
            <select value={game.config.seedsPerPit} disabled={!pristine} onChange={(e) => chooseRules({ seedsPerPit: Number(e.target.value) })}>
              {SEED_OPTIONS.map((n) => <option key={n} value={n}>{n} ({seedsNote(n)})</option>)}
            </select>
          </label>
          <label>Sowings in a turn
            <select value={game.config.maxSowings} disabled={!pristine} onChange={(e) => chooseRules({ maxSowings: Number(e.target.value) })}>
              {SOWING_OPTIONS.map((n) => <option key={n} value={n}>{n === 1 ? '1 (no extra sowing)' : n === 2 ? '2 (standard)' : '3'}</option>)}
            </select>
          </label>
          <label>A Saada that captures nothing
            <select value={game.config.zeroCaptureGrantsSecond ? 'yes' : 'no'} disabled={!pristine} onChange={(e) => chooseRules({ zeroCaptureGrantsSecond: e.target.value === 'yes' })}>
              <option value="no">Ends the turn (default)</option>
              <option value="yes">Still earns the next sowing</option>
            </select>
          </label>
          <label>When a player has no seeds to sow
            <select value={game.config.stranded} disabled={!pristine} onChange={(e) => chooseRules({ stranded: e.target.value as Config['stranded'] })}>
              <option value="owner-keeps">The round ends, seeds stay with their row's owner (default)</option>
              <option value="pass">They pass, the other keeps sowing</option>
            </select>
          </label>
          <label>Length
            <select value={game.config.match} disabled={!pristine} onChange={(e) => chooseRules({ match: e.target.value as Config['match'] })}>
              <option value="match">A match of rounds with refills (default)</option>
              <option value="single">A single round</option>
            </select>
          </label>
          <ul>{describeConfig(game.config).map((line) => <li key={line}>{line}</li>)}</ul>
          <button type="button" className="secondary-btn" onClick={() => setRulesOpen(false)}>Close</button>
        </div>
      )}

      <div className="pg-table">
        {([1, 0] as const).map((p) => (
          <div key={p} className="pg-tray" data-player={p} data-edge={p === 1 ? 'top' : 'bottom'} style={{ order: p === 1 ? 0 : 2 }} aria-label={`${names[p]} captured seeds`}>
            <span className="pg-tray-name">{names[p]}</span>
            <span className="pg-tray-seeds" aria-hidden="true">
              {Array.from({ length: Math.min(stores[p], 22) }, (_, k) => <i key={k} />)}
            </span>
            <b data-testid={`store-${p}`}>{stores[p]}</b>
          </div>
        ))}
        <div className="pg-board" role="group" aria-label="Pallanguzhi board: top row Player 2, bottom row Player 1, sowing counterclockwise" style={{ order: 1 }}>
          {rowsTopToBottom.flat().map((pit) => {
            const owner = ownerOf(pit)
            const count = pits[pit]
            const selectable = humanTurn && legal.includes(pit) && (!tutorial || pit === hint)
            const inactive = !game.active[pit]
            const isHint = hint === pit
            return (
              <button
                key={pit}
                type="button"
                ref={(el) => { pitRefs.current[pit] = el }}
                className="pg-pit"
                data-pit={pit}
                data-owner={owner}
                data-count={count}
                data-legal={selectable || undefined}
                data-inactive={inactive || undefined}
                data-hint={isHint || undefined}
                data-active={live?.busy === pit || undefined}
                data-saada={live?.saada === pit || (!anim && game.lastEmpty === pit && game.phase !== 'play') || undefined}
                data-taken={live?.taken.includes(pit) || undefined}
                data-focus={focusPit === pit || undefined}
                aria-disabled={!selectable}
                aria-label={`${names[owner]} pit ${label(pit)}: ${inactive ? 'inactive piggy pit' : plural(count, 'seed')}${selectable ? ', choose to sow' : ''}`}
                onClick={() => onPit(pit)}
                onFocus={() => setFocusPit(pit)}
              >
                {inactive ? <span className="pg-piggy" aria-hidden="true">×</span> : <Seeds pit={pit} count={count} />}
                <b className="pg-count" aria-hidden="true">{inactive ? '' : count}</b>
              </button>
            )
          })}
        </div>
      </div>

      {live && live.hand > 0 && <p className="pg-hand" aria-hidden="true">In hand: {live.hand}</p>}
      <p className="pg-note" role="status" aria-live="polite">{note || (humanTurn ? `${names[game.turn]}: choose a pit with seeds in your row (keys 1 to 7).` : '')}</p>

      {game.phase === 'round-over' && (
        <div className="pg-banner" role="group" aria-label="Round over">
          <p>
            <strong>Round {game.round} over.</strong> {names[0]} holds {game.stores[0]} seeds ({plural(refillPlan[0], 'pit')} can be refilled); {names[1]} holds {game.stores[1]} ({plural(refillPlan[1], 'pit')}).
          </p>
          <button type="button" className="primary-btn" onClick={nextRound}>Start round {game.round + 1}</button>
        </div>
      )}
      {over && (
        <div className="pg-banner" role="group" aria-label="Match over">
          <p>
            <strong>{game.winner === 'draw' ? 'The match is drawn.' : `${names[game.winner as Player]} wins the match!`}</strong>{' '}
            {names[0]}: {game.stores[0]} seeds. {names[1]}: {game.stores[1]} seeds. Rounds played: {game.round}.
          </p>
          <button type="button" className="primary-btn" onClick={() => freshMatch()}>Play again</button>
        </div>
      )}

      {tutorial && (
        <section className="pg-lesson" aria-label="Tutorial">
          <p className="eyebrow">Lesson {step + 1} of {TUTORIAL.length}</p>
          <h3>{step0.title}</h3>
          <p>{stepDone && step0.after ? step0.after : step0.text}</p>
          <div className="pg-lesson-nav">
            <button type="button" className="secondary-btn" onClick={() => goStep(step - 1)} disabled={step === 0 || !!anim}>Back</button>
            {step < TUTORIAL.length - 1 ? (
              <button type="button" className="primary-btn" onClick={() => goStep(step + 1)} disabled={(step0.expect !== undefined && !stepDone) || !!anim}>Next</button>
            ) : (
              <button type="button" className="primary-btn" onClick={() => freshMatch('computer')}>Play the computer</button>
            )}
          </div>
        </section>
      )}

      <details className="pg-more">
        <summary>Accessibility and sound</summary>
        <label><input type="checkbox" checked={settings.contrast} onChange={(e) => update({ contrast: e.target.checked })} /> High contrast</label>
        <label><input type="checkbox" checked={settings.reduceMotion} onChange={(e) => update({ reduceMotion: e.target.checked })} /> Reduce motion (no animation)</label>
        <label><input type="checkbox" checked={settings.sound} onChange={(e) => update({ sound: e.target.checked })} /> Sound effects</label>
        <button type="button" className="secondary-btn" onClick={() => update(DEFAULT_SETTINGS)}>Reset</button>
      </details>
      <p className="game-help">{PITS} pits, five seeds each. Sowing runs counterclockwise. Keys 1 to 7 choose a pit; arrow keys move between pits.</p>
    </div>
  )
}
