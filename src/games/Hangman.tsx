import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Lightbulb, Settings } from 'lucide-react'
import { createRandom, dailySeed } from '../lib/rng'
import { playSound } from '../lib/sound'
import type { GameProps } from '../types'
import { ATTEMPT_BONUS, BASE_SCORE, HINT_COST, MAX_HINTS, attemptsLeft, canHint, dailyPick, gallowsParts, guess, hint, masked, newGame, pickWord, scoreFor, validSecret, wrongLetters, type HState } from './hangman/rules'
import { readStats, writeStats, type HangmanStats } from './hangman/storage'
import { CATEGORIES, DIFFICULTIES, categoryTitle, type CategoryId, type Difficulty } from './hangman/words'
import './hangman/hangman.css'

type Mode = 'solo' | 'two' | 'daily'
type Settings = { mode: Mode; category: CategoryId | 'any'; difficulty: Difficulty; hints: boolean }
const DEFAULTS: Settings = { mode: 'solo', category: 'any', difficulty: 'medium', hints: true }
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
const TWO_PLAYER_SETTER_POINTS = 100

/** The gallows, drawn part by part: base, pole, beam, rope, head, body, two arms, two legs. */
const PARTS = [
  <path key="b" d="M10 120h60" />, <path key="p" d="M40 120V12" />, <path key="m" d="M40 12h50" />, <path key="r" d="M90 12v16" />,
  <circle key="h" cx="90" cy="38" r="10" />, <path key="t" d="M90 48v32" />, <path key="a1" d="M90 56l-14 14" />, <path key="a2" d="M90 56l14 14" />,
  <path key="l1" d="M90 80l-12 20" />, <path key="l2" d="M90 80l12 20" />,
]

function Gallows({ wrong, max }: { wrong: number; max: number }) {
  const n = gallowsParts(wrong, max)
  return (
    <svg className="hm-gallows" viewBox="0 0 120 130" role="img" aria-label={`Gallows: ${wrong} of ${max} wrong guesses used`} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
      {PARTS.slice(0, n)}
    </svg>
  )
}

export function Hangman({ onFinish, seed }: GameProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [draft, setDraft] = useState<Settings>(DEFAULTS)
  const [screen, setScreen] = useState<'game' | 'setup' | 'secret'>('game')
  const [stats, setStats] = useState<HangmanStats>(readStats)
  const [run, setRun] = useState(0)
  const random = useMemo(() => createRandom(seed === undefined ? undefined : `${seed}:${run}`), [seed, run])
  const recent = useRef<string[]>([])
  const startedAt = useRef(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [points, setPoints] = useState<[number, number]>([0, 0])
  const [setter, setSetter] = useState<0 | 1>(0)
  const [secret, setSecret] = useState({ word: '', clue: '' })
  const [secretError, setSecretError] = useState('')
  const [notice, setNotice] = useState('')
  const [result, setResult] = useState('')
  const today = dailySeed()
  const dailyDone = stats.daily?.day === today ? stats.daily : null

  const startWord = useCallback(
    (s: Settings): HState => {
      startedAt.current = 0
      setResult('')
      setNotice('')
      if (s.mode === 'daily') {
        const p = dailyPick(today)
        return newGame(p.entry.word, p.entry.clue, categoryTitle(p.category), 'medium')
      }
      const p = pickWord(s.category, s.difficulty, random, recent.current)
      recent.current = [...recent.current.slice(-39), p.entry.word]
      return newGame(p.entry.word, p.entry.clue, categoryTitle(p.category), s.difficulty)
    },
    [random, today],
  )
  const [game, setGame] = useState<HState>(() => startWord(DEFAULTS))

  const finish = useCallback(
    (next: HState) => {
      const won = next.status === 'won'
      playSound(won ? 'win' : 'lose')
      if (settings.mode === 'two') {
        const guesser = setter === 0 ? 1 : 0
        const earned = won ? scoreFor(next, 1) : TWO_PLAYER_SETTER_POINTS
        const who = won ? guesser : setter
        setPoints((p) => (who === 0 ? [p[0] + earned, p[1]] : [p[0], p[1] + earned]))
        setResult(won ? `Player ${guesser + 1} got it! +${earned} points` : `Not this time. The word was ${next.word.toUpperCase()}. Player ${setter + 1} scores ${earned}.`)
        return
      }
      const newStreak = won ? streak + 1 : 0
      const earned = scoreFor(next, newStreak)
      setStreak(newStreak)
      setScore((n) => n + earned)
      const upd: HangmanStats = {
        ...stats,
        played: stats.played + 1,
        solved: stats.solved + (won ? 1 : 0),
        bestStreak: Math.max(stats.bestStreak, newStreak),
        daily: settings.mode === 'daily' ? { day: today, won, word: next.word } : stats.daily,
      }
      setStats(upd)
      writeStats(upd)
      setResult(won ? `You got it! +${earned} points${newStreak > 1 ? ` (${newStreak} in a row)` : ''}` : `The word was ${next.word.toUpperCase()}.`)
      onFinish({
        score: earned,
        durationMs: Math.max(0, Date.now() - startedAt.current),
        won,
        stats: { streak: newStreak, wrong: next.guessed.filter((l) => !next.word.includes(l)).length, hints: next.hintsUsed, length: next.word.length, level: DIFFICULTIES.findIndex((d) => d[0] === next.difficulty) + 1, daily: settings.mode === 'daily' ? 1 : 0 },
      })
    },
    [settings.mode, setter, streak, stats, today, onFinish],
  )

  const commit = useCallback(
    (next: HState, message: string) => {
      setGame(next)
      setNotice(message)
      if (next.status !== 'playing' && game.status === 'playing') finish(next)
    },
    [game.status, finish],
  )

  const press = useCallback(
    (letter: string) => {
      if (screen !== 'game' || game.status !== 'playing' || game.guessed.includes(letter)) return
      if (!startedAt.current) startedAt.current = Date.now()
      const next = guess(game, letter)
      if (next === game) return
      const count = [...game.word].filter((l) => l === letter).length
      playSound(count ? 'good' : 'bad')
      commit(next, count ? `${letter.toUpperCase()} is in the word ${count} time${count === 1 ? '' : 's'}.` : `No ${letter.toUpperCase()}. ${attemptsLeft(next)} attempt${attemptsLeft(next) === 1 ? '' : 's'} left.`)
    },
    [screen, game, commit],
  )

  const onHint = () => {
    if (!settings.hints || !canHint(game)) return
    if (!startedAt.current) startedAt.current = Date.now()
    const next = hint(game, random)
    if (next === game) return
    commit(next, !game.clueShown && game.clue ? 'Clue revealed.' : 'A letter was revealed.')
  }

  const nextWord = useCallback(() => {
    if (settings.mode === 'two') {
      setSetter((s) => (s === 0 ? 1 : 0))
      setSecret({ word: '', clue: '' })
      setSecretError('')
      return setScreen('secret')
    }
    if (settings.mode === 'daily') {
      const s = { ...settings, mode: 'solo' as Mode, difficulty: 'medium' as Difficulty }
      setSettings(s)
      return setGame(startWord(s))
    }
    setGame(startWord(settings))
  }, [settings, startWord])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || screen !== 'game') return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      const k = e.key.toLowerCase()
      if (k === 'enter' && game.status !== 'playing' && !(t && t.tagName === 'BUTTON')) return nextWord()
      if (/^[a-z]$/.test(k)) press(k)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const apply = (s: Settings) => {
    const fixed: Settings = s.mode === 'daily' ? { ...s, difficulty: 'medium', category: 'any' } : s
    setSettings(fixed)
    setRun((r) => r + 1)
    setScore(0)
    setStreak(0)
    setPoints([0, 0])
    setSetter(0)
    recent.current = []
    setSecret({ word: '', clue: '' })
    setSecretError('')
    if (fixed.mode === 'two') return setScreen('secret')
    setGame(startWord(fixed))
    setScreen('game')
  }

  const startTwoPlayerRound = () => {
    const w = secret.word.trim().toLowerCase()
    if (!validSecret(w)) return setSecretError('Use 3 to 20 letters, with no spaces or numbers.')
    startedAt.current = 0
    setResult('')
    setNotice('')
    setGame(newGame(w, secret.clue.trim(), 'Chosen by Player ' + (setter + 1), settings.difficulty))
    setScreen('game')
  }

  if (screen === 'setup')
    return (
      <div className="hm">
        <div className="game-toolbar c4-bar"><div><small>Hangman</small><strong className="c4-status">New game</strong></div></div>
        <form className="hm-setup" onSubmit={(e) => { e.preventDefault(); apply(draft) }}>
          <label>Mode<select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as Mode })}><option value="solo">One player</option><option value="two">Two players on this device</option><option value="daily">Daily word (same for everyone)</option></select></label>
          <label>Category<select value={draft.category} disabled={draft.mode !== 'solo'} onChange={(e) => setDraft({ ...draft, category: e.target.value as Settings['category'] })}><option value="any">Any category</option>{CATEGORIES.map(([id, t]) => <option key={id} value={id}>{t}</option>)}</select></label>
          <label>Difficulty<select value={draft.mode === 'daily' ? 'medium' : draft.difficulty} disabled={draft.mode === 'daily'} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as Difficulty })}>{DIFFICULTIES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
          <label className="hm-check"><input type="checkbox" checked={draft.hints} onChange={(e) => setDraft({ ...draft, hints: e.target.checked })} />Allow hints (each costs {HINT_COST} points)</label>
          <p className="hm-help">A word is worth {BASE_SCORE.easy}, {BASE_SCORE.medium} or {BASE_SCORE.hard} points by difficulty, plus {ATTEMPT_BONUS} for each attempt left and a bonus for a winning streak.</p>
          <div className="hm-actions"><button type="submit" className="primary-btn">Start</button><button type="button" onClick={() => setScreen('game')}>Back</button></div>
        </form>
      </div>
    )

  if (screen === 'secret')
    return (
      <div className="hm">
        <div className="game-toolbar c4-bar"><div><small>Player {setter === 0 ? 1 : 2} sets the word</small><strong className="c4-status">Player {(setter === 0 ? 2 : 1)}, look away</strong></div></div>
        <form className="hm-setup" onSubmit={(e) => { e.preventDefault(); startTwoPlayerRound() }}>
          <label>Secret word<input type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={secret.word} onChange={(e) => setSecret({ ...secret, word: e.target.value })} aria-describedby="hm-secret-help" /></label>
          <label>Clue (optional)<input type="text" autoComplete="off" value={secret.clue} maxLength={60} onChange={(e) => setSecret({ ...secret, clue: e.target.value })} /></label>
          <p id="hm-secret-help" className="hm-help">3 to 20 letters. The word is hidden as you type. Then pass the device to Player {setter === 0 ? 2 : 1}.</p>
          {secretError ? <p role="alert" className="hm-error">{secretError}</p> : null}
          <div className="hm-actions"><button type="submit" className="primary-btn">Hide and pass the device</button><button type="button" onClick={() => { setDraft(settings); setScreen('setup') }}>Settings</button></div>
        </form>
      </div>
    )

  const over = game.status !== 'playing'
  const wrong = wrongLetters(game)
  const shown = masked(game)
  const label = settings.mode === 'two' ? `Two players · ${game.category}` : settings.mode === 'daily' ? `Daily word · ${today}` : `${game.category} · ${DIFFICULTIES.find((d) => d[0] === game.difficulty)?.[1]}`
  const status = over ? (game.status === 'won' ? 'Solved!' : 'Out of attempts') : `${attemptsLeft(game)} attempt${attemptsLeft(game) === 1 ? '' : 's'} left`
  const guesser = setter === 0 ? 2 : 1

  return (
    <div className="hm">
      <div className="game-toolbar c4-bar">
        <div><small>{label}</small><strong className="c4-status" aria-live="polite">{status}</strong></div>
        <div className="hm-btns">
          {settings.hints && !over ? <button onClick={onHint} disabled={!canHint(game)} aria-label={`Hint, costs ${HINT_COST} points, ${MAX_HINTS - game.hintsUsed} left`}><Lightbulb size={15} />Hint ({MAX_HINTS - game.hintsUsed})</button> : null}
          <button onClick={() => { setDraft(settings); setScreen('setup') }}><Settings size={15} />New game</button>
        </div>
      </div>
      <div className="hm-score" aria-label="Score">
        {settings.mode === 'two' ? <><span>Player 1 <b>{points[0]}</b></span><span>Player 2 <b>{points[1]}</b></span><span>Player {guesser} guesses</span></> : <><span>Score <b>{score}</b></span><span>Streak <b>{streak}</b></span><span>Best streak <b>{stats.bestStreak}</b></span></>}
      </div>
      {settings.mode === 'daily' && dailyDone && !over ? <p className="hm-note">You already played today's word, so this one will not count again.</p> : null}
      <div className="hm-stage">
        <Gallows wrong={wrong.length} max={game.max} />
        <div className="hm-right">
          <div className="hm-word" role="group" aria-label={`Word: ${shown.map((l) => l ?? 'blank').join(' ')}`}>
            {shown.map((l, i) => <span key={i} data-blank={l === null || undefined} data-missed={(over && game.status === 'lost' && !game.guessed.includes(game.word[i])) || undefined}>{l ? l.toUpperCase() : ''}</span>)}
          </div>
          <p className="hm-wrong" aria-label="Wrong letters">Wrong: {wrong.length ? wrong.map((l) => l.toUpperCase()).join(' ') : 'none yet'}</p>
          <p className="hm-clue" aria-live="polite">{game.clueShown && game.clue ? `Clue: ${game.clue}` : ''}</p>
        </div>
      </div>
      <p className="hm-note" aria-live="polite">{result || notice}</p>
      {over ? <div className="hm-actions"><button className="primary-btn" autoFocus onClick={nextWord}>{settings.mode === 'two' ? 'Next round (swap roles)' : 'New word'}</button></div> : null}
      <div className="hm-kb" role="group" aria-label="Letters">
        {ROWS.map((row) => (
          <div key={row} className="hm-row">
            {[...row].map((l) => {
              const used = game.guessed.includes(l)
              const right = used && game.word.includes(l)
              return (
                <button key={l} data-state={used ? (right ? 'right' : 'wrong') : undefined} disabled={used || over} onClick={() => press(l)} aria-label={`Letter ${l.toUpperCase()}${used ? (right ? ', in the word' : ', not in the word') : ''}`}>
                  {l.toUpperCase()}{used ? <small aria-hidden="true">{right ? '✓' : '✗'}</small> : null}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
