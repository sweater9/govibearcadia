import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { chooseClaim, chooseTurnAction, LEVELS, type Level } from './mahjong/ai'
import { describeConfig, isStandard, loadRules, normaliseConfig, OPTIONS, saveRules, STAKES } from './mahjong/config'
import { DEFAULT_CONFIG, act, kongChoices, newMatch, selfDrawScore, startNextHand, windOf, type Config, type Decision, type Event, type State } from './mahjong/rules'
import { clearSaved, loadSaved, save, type Saved } from './mahjong/save'
import { TileFace } from './mahjong/TileFace'
import { isDragon, isFlower, isHonour, rankOf, suitOf, tileName, tileShort } from './mahjong/tiles'

const WINDS = ['East', 'South', 'West', 'North']
const NAMES = ['You', 'Computer 1', 'Computer 2', 'Computer 3']
const COMPUTER_MS = 650

function Tile({ t, small, selected, onClick, label, tag }: { t: number; small?: boolean; selected?: boolean; onClick?: () => void; label?: string; tag?: string }) {
  const cls = `mj-tile${small ? ' mj-small' : ''}${selected ? ' mj-sel' : ''} ${isFlower(t) ? 'mj-f' : isHonour(t) ? (isDragon(t) ? `mj-dr${t - 31}` : 'mj-w') : `mj-s${suitOf(t)}`}${tag ? ` ${tag}` : ''}`
  const body = <TileFace t={t} />
  return onClick ? (
    <button type="button" className={cls} onClick={onClick} aria-label={label ?? tileName(t)} aria-pressed={selected}>{body}</button>
  ) : (
    <span className={cls} role="img" aria-label={label ?? tileName(t)}>{body}</span>
  )
}

function describe(e: Event): string {
  const who = (seat: number) => NAMES[seat]
  switch (e.kind) {
    case 'flower': return `${who(e.seat)} shows ${tileName(e.tile)}`
    case 'discard': return `${who(e.seat)} discards ${tileName(e.tile)}`
    case 'chow': return `${who(e.seat)} chows ${tileName(e.tile)}…`
    case 'pung': return `${who(e.seat)} pungs ${tileName(e.tile)}`
    case 'kong': case 'concealed-kong': case 'added-kong': return `${who(e.seat)} kongs ${tileName(e.tile)}`
    case 'win': return `${who(e.seat)} wins${e.from === null ? ' by self-draw' : ` on ${who(e.from)}’s discard`}`
    case 'draw-game': return 'The wall is out: a draw'
  }
}

export function Mahjong({ onFinish, seed }: GameProps) {
  const [resume] = useState<Saved | null>(() => (seed === undefined ? loadSaved() : null))
  const [level, setLevel] = useState<Level>('medium')
  const [rules, setRules] = useState<Config>(() => (seed === undefined ? loadRules() : DEFAULT_CONFIG))
  const setRule = (patch: Partial<Config>) => setRules((r) => normaliseConfig({ ...r, ...patch }))
  const [started, setStarted] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [state, setState] = useState<State | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [log, setLog] = useState('')
  const startedAt = useRef(0)
  const reported = useRef(false)
  const base = useRef(seed ?? `mj-${Date.now()}`)
  const random = useMemo(() => createRandom(seed === undefined ? undefined : `${seed}-play`), [seed])
  const stats = useRef({ hands: 0, wins: 0, best: 0 })

  const begin = (s: State, saved?: Saved) => {
    reported.current = false
    startedAt.current = saved?.startedAt ?? Date.now()
    if (saved) {
      base.current = saved.seed
      setLevel(saved.level)
    }
    setState(s)
    setStarted(true)
    setLog('')
    setSelected(null)
  }

  const apply = useCallback((s: State, action: Parameters<typeof act>[1]) => {
    const r = act(s, action)
    if (!r.ok) return
    setState(r.state)
    setSelected(null)
    const lines = r.state.events.map(describe)
    setLog(lines.slice(-2).join('. '))
  }, [])

  // The computers' turns, and claims when the human has nothing to decide.
  useEffect(() => {
    if (!state || !started) return
    if (state.phase === 'discard' && state.turn !== 0) {
      const t = setTimeout(() => apply(state, chooseTurnAction(state, state.turn, level, random)), COMPUTER_MS)
      return () => clearTimeout(t)
    }
    if (state.phase === 'claim' && !state.options[0]) {
      const t = setTimeout(() => {
        const decisions: Record<number, Decision> = {}
        for (const k of Object.keys(state.options)) decisions[Number(k)] = chooseClaim(state, Number(k), level, random)
        apply(state, { type: 'decide', decisions })
      }, COMPUTER_MS / 2)
      return () => clearTimeout(t)
    }
  }, [state, started, level, random, apply])

  // Count the human's wins as hands end.
  const lastResult = useRef<unknown>(null)
  useEffect(() => {
    if (!state?.result || lastResult.current === state.result) return
    lastResult.current = state.result
    stats.current.hands++
    if (state.result.kind === 'win' && state.result.winner === 0) {
      stats.current.wins++
      stats.current.best = Math.max(stats.current.best, state.result.tai)
    }
  }, [state])

  // Save between hands and moves; report the result once.
  useEffect(() => {
    if (!state || !started) return
    if (state.phase === 'over') {
      clearSaved()
      if (!reported.current) {
        reported.current = true
        const mine = state.scores[0]
        onFinish({
          score: Math.max(0, mine),
          durationMs: Date.now() - startedAt.current,
          won: mine === Math.max(...state.scores) && state.scores.filter((x) => x === mine).length === 1,
          stats: { hands: state.handNo, handsWon: stats.current.wins, bestTai: stats.current.best, level: LEVELS.indexOf(level) + 1, rank: 1 + state.scores.filter((x) => x > mine).length },
        })
      }
    } else if (seed === undefined) save({ v: 1, level, startedAt: startedAt.current, state, seed: base.current })
  }, [state, started, level, onFinish, seed])

  if (!started || !state) {
    return (
      <div className="mj-setup">
        <h2>Taiwanese Mahjong</h2>
        <p className="mj-note">16-tile Mahjong with flowers: five sets and a pair, scored in tai. You play three computers.</p>
        <div className="mj-row" role="group" aria-label="Difficulty">
          {LEVELS.map((l) => (
            <button key={l} type="button" className={`secondary-btn${level === l ? ' mj-on' : ''}`} aria-pressed={level === l} onClick={() => setLevel(l)}>{l[0].toUpperCase() + l.slice(1)}</button>
          ))}
        </div>
        <div className="mj-rules" role="group" aria-label="Rules">
          <label>Length<select value={rules.match} onChange={(e) => setRule({ match: e.target.value as Config['match'] })}>{OPTIONS.match.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>Stakes<select value={`${rules.base}-${rules.unit}`} onChange={(e) => { const s = STAKES.find((x) => x.id === e.target.value); if (s) setRule({ base: s.base, unit: s.unit }) }}>{STAKES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <label>Dealer bonus<select value={rules.dealerBonus} onChange={(e) => setRule({ dealerBonus: e.target.value as Config['dealerBonus'] })}>{OPTIONS.dealerBonus.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>Wind pungs<select value={rules.windPungs} onChange={(e) => setRule({ windPungs: e.target.value as Config['windPungs'] })}>{OPTIONS.windPungs.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label>To win<select value={String(rules.minTai)} onChange={(e) => setRule({ minTai: Number(e.target.value) })}>{OPTIONS.minTai.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <button type="button" className="secondary-btn" disabled={isStandard(rules)} onClick={() => setRules(DEFAULT_CONFIG)}>Standard rules</button>
        </div>
        <div className="mj-row">
          <button type="button" className="primary-btn" onClick={() => { begin(newMatch(createRandom(`${base.current}-1`), rules)); if (seed === undefined) saveRules(rules) }}>Start</button>
          {resume && <button type="button" className="secondary-btn" onClick={() => begin(resume.state, resume)}>Resume saved game</button>}
        </div>
      </div>
    )
  }

  const me = state.seats[0]
  const myTurn = state.phase === 'discard' && state.turn === 0
  const sorted = [...me.hand]
  let drawnTile: number | null = null
  if (myTurn && state.drawn !== null) {
    sorted.splice(sorted.indexOf(state.drawn), 1)
    drawnTile = state.drawn
  }
  sorted.sort((a, b) => a - b)
  const o = state.phase === 'claim' ? state.options[0] : undefined
  const sd = myTurn ? selfDrawScore(state, 0) : null
  const kongs = myTurn ? kongChoices(state, 0) : { concealed: [], added: [] }
  const decide = (d: Decision) => {
    const decisions: Record<number, Decision> = { 0: d }
    for (const k of Object.keys(state.options)) if (Number(k) !== 0) decisions[Number(k)] = chooseClaim(state, Number(k), level, random)
    // A human pass leaves the computers free to claim; a human claim outranks a computer's lower claim, and wins outrank all.
    apply(state, { type: 'decide', decisions })
  }
  const tapTile = (t: number, key: number) => {
    if (!myTurn) return
    if (selected === key) apply(state, { type: 'discard', tile: t })
    else setSelected(key)
  }

  const res = state.result
  const status =
    state.phase === 'over' ? 'The match is over.'
    : state.phase === 'hand-over' ? (res?.kind === 'win' ? `${NAMES[res.winner]} won with ${res.tai} tai.` : 'A draw: nobody wins this hand.')
    : myTurn ? 'Your turn: tap a tile to pick it, tap again to discard.'
    : state.phase === 'claim' ? (o ? 'You can claim the discard.' : 'Computers are deciding…')
    : `${NAMES[state.turn]} is playing…`

  return (
    <div className="mj-wrap">
      <div className="mj-opps">
        {[3, 2, 1].map((i) => (
          <div key={i} className={`mj-opp${state.turn === i && state.phase === 'discard' ? ' mj-turn' : ''}`}>
            <div className="mj-opp-head"><strong>{NAMES[i]}</strong> <span>{WINDS[windOf(state, i)]}{state.dealer === i ? ' · dealer' : ''}</span></div>
            <div className="mj-opp-sub"><span data-testid={`mj-score-${i}`}>{state.scores[i]}</span> pts · {state.seats[i].hand.length} tiles · {state.seats[i].flowers.length} flowers</div>
            <div className="mj-backs" aria-hidden="true">{Array.from({ length: state.seats[i].hand.length }, (_, k) => <i key={k} />)}</div>
            <div className="mj-melds">{state.seats[i].melds.map((m, k) => <span key={k} className="mj-meld">{m.kind}{m.kind === 'chow' ? ` ${tileShort(m.tile)}` : ` ${tileShort(m.tile)}`}</span>)}</div>
          </div>
        ))}
      </div>

      <div className="mj-pool" aria-label="Discards" data-testid="mj-pool">
        {state.seats.flatMap((p, i) => p.discards.map((t, k) => ({ t, i, k }))).length === 0 && <span className="mj-note">No discards yet</span>}
        {state.seats.flatMap((p, i) => p.discards.map((t, k) => <Tile key={`${i}-${k}`} t={t} small tag={`mj-d${i}${state.last && state.last.from === i && k === p.discards.length - 1 && state.last.tile === t ? ' mj-latest' : ''}`} />))}
      </div>

      <p className="mj-status" role="status" aria-live="polite">{status} <span className="mj-log">{log}</span></p>

      <div className="mj-mine">
        <div className="mj-meta"><strong>You</strong> · {WINDS[windOf(state, 0)]}{state.dealer === 0 ? ' · dealer' : ''} · <span data-testid="mj-score-0">{state.scores[0]}</span> pts · hand {state.handNo}{state.lian > 0 && state.dealer === 0 ? ` · streak ${state.lian}` : ''}
          {me.melds.map((m, k) => <span key={k} className="mj-meld">{m.kind} {tileShort(m.tile)}</span>)}
          {me.flowers.length > 0 && <span className="mj-meld">flowers {me.flowers.map(tileShort).join(' ')}</span>}
        </div>
        <div className="mj-hand" data-testid="mj-hand">
          {sorted.map((t, i) => <Tile key={`h${i}`} t={t} selected={selected === i} onClick={myTurn ? () => tapTile(t, i) : undefined} />)}
          {drawnTile !== null && <><span className="mj-gap" /><Tile t={drawnTile} selected={selected === 99} onClick={() => tapTile(drawnTile as number, 99)} label={`${tileName(drawnTile)} (just drawn)`} /></>}
        </div>
      </div>

      <div className="mj-row">
        {sd && <button type="button" className="primary-btn" onClick={() => apply(state, { type: 'tsumo' })}>Win ({sd.tai} tai)</button>}
        {kongs.concealed.map((t) => <button key={`c${t}`} type="button" className="secondary-btn" onClick={() => apply(state, { type: 'concealed-kong', tile: t })}>Kong {tileShort(t)}</button>)}
        {kongs.added.map((t) => <button key={`a${t}`} type="button" className="secondary-btn" onClick={() => apply(state, { type: 'added-kong', tile: t })}>Add to kong {tileShort(t)}</button>)}
        {o?.win && <button type="button" className="primary-btn" onClick={() => decide({ type: 'win' })}>Win</button>}
        {o?.kong && <button type="button" className="secondary-btn" onClick={() => decide({ type: 'kong' })}>Kong</button>}
        {o?.pung && <button type="button" className="secondary-btn" onClick={() => decide({ type: 'pung' })}>Pung</button>}
        {o?.chows.map((low) => <button key={low} type="button" className="secondary-btn" onClick={() => decide({ type: 'chow', low })}>Chow {rankOf(low)}-{rankOf(low) + 1}-{rankOf(low) + 2}</button>)}
        {o && <button type="button" className="secondary-btn" onClick={() => decide({ type: 'pass' })}>Pass</button>}
        {state.phase === 'hand-over' && <button type="button" className="primary-btn" onClick={() => { const s = startNextHand(state, createRandom(`${base.current}-${state.handNo + 1}`)); setState(s); setLog('') }}>Next hand</button>}
        {state.phase === 'over' && <button type="button" className="primary-btn" onClick={() => { setStarted(false); setState(null); base.current = seed ?? `mj-${Date.now()}` }}>New game</button>}
        <button type="button" className="secondary-btn" onClick={() => setRulesOpen((r) => !r)} aria-expanded={rulesOpen}>Scoring</button>
      </div>

      {(state.phase === 'hand-over' || state.phase === 'over') && res && (
        <div className="mj-result" role="dialog" aria-label="Hand result">
          {res.kind === 'win' ? (
            <>
              <h3>{NAMES[res.winner]} wins: {res.tai} tai</h3>
              <ul>{res.items.map((i) => <li key={i.name}>{i.name}: {i.tai}</li>)}</ul>
              <p className="mj-note">{res.selfDraw ? 'Self-drawn: all three pay.' : `Paid by ${NAMES[res.from as number]}.`} Points: {res.deltas.map((d, i) => `${NAMES[i]} ${d >= 0 ? '+' : ''}${d}`).join(', ')}</p>
            </>
          ) : <h3>Draw: the dealer stays</h3>}
          {state.phase === 'over' && <p><strong>Final: {state.scores.map((x, i) => `${NAMES[i]} ${x}`).join(' · ')}</strong></p>}
        </div>
      )}

      {rulesOpen && (
        <div className="mj-result" role="dialog" aria-label="Scoring">
          <h3>Scoring (tai)</h3>
          <p className="mj-note">A win pays {state.config.base} + {state.config.unit} × tai. Winning on a discard: the discarder pays. Self-draw: all three pay. {state.config.dealerBonus === 'none' ? 'There is no dealer bonus.' : state.config.dealerBonus === 'flat' ? 'The dealer adds 1 tai to every payment they make or receive.' : 'The dealer adds 1 tai, plus 2 for each hand they have kept the deal, to every payment they make or receive.'}{state.config.minTai ? ` A hand needs at least ${state.config.minTai} tai to win.` : ''}</p>
          <p className="mj-note">Rules this game: {describeConfig(state.config)}{isStandard(state.config) ? ' (standard)' : ' (custom)'}.</p>
          <p className="mj-note">Self-draw 1 · concealed hand 1 · concealed self-draw 3 (in all) · win after a kong 1 · dragon pung 1 · seat wind 1 · round wind 1{state.config.windPungs === 'all' ? ' · other wind pung 1' : ''} · seat flower 1 each · all chows 2 · melded hand 2 · three concealed pungs 2 · four 5 · five 8 · all pungs 4 · little three dragons 4 · big three dragons 8 · half flush 4 · full flush 8 · all honours 8 · little four winds 8 · big four winds 16 · all eight flowers 8.</p>
          <button type="button" className="secondary-btn" onClick={() => setRulesOpen(false)}>Close</button>
        </div>
      )}
    </div>
  )
}
