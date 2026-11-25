import { ArrowLeft, Heart, Lock, Unlock } from 'lucide-react'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { GameBoundary } from '../components/GameBoundary'
import { getGame } from '../games/registry'
import { db, recordPlay, toggleFavorite } from '../lib/db'
import { SoundToggle } from '../components/SoundToggle'
import { attachGameSound } from '../lib/sound'
import { attachGameEffects } from '../lib/effects'
import { coinsFor } from '../lib/wallet'
import { GameRow } from '../components/GameRow'
import { games } from '../data/games'
import { lockScreen, unlockScreen } from '../lib/screenLock'
import { ShareButton } from '../components/ShareButton'
import { challengePath, parseChallenge, randomSeed, shareChallenge, shareScore, verdict, verdictText } from '../lib/challenge'
import { gameDescription, gameTitle } from '../lib/gamePages'
import { GameAbout } from '../components/GameAbout'
import { HowToPlay } from '../components/HowToPlay'
import { LevelBar } from '../components/LevelBar'
import { isLeveled, levelCleared, readCleared, saveCleared } from '../lib/levels'
import { getNick } from '../lib/online'
import { usePageMeta } from '../lib/pageMeta'
import { computerLabel, parseComputer } from '../lib/computerPlayers'
import { dailyChallenge, shareDaily, today } from '../lib/passport'
import type { GameResult } from '../types'

export function Play() {
  const { id } = useParams()
  // `?seed=` makes a game deterministic: the same seed always deals the same game. Daily challenges will use it.
  const params = useSearchParams()[0]
  const entry = getGame(id)
  // Challengeable puzzles always get a seed, so any run can be sent to a friend afterwards to be dealt the same puzzle.
  const [fallbackSeed] = useState(() => randomSeed())
  const seed = params.get('seed') ?? (entry?.meta.challenge ? fallbackSeed : undefined)
  const computer = parseComputer(params.get('vs'))
  const incoming = entry?.meta.challenge ? parseChallenge(params) : null
  // `?daily=<day>` counts only when it is today's challenge for this game, with the challenge's seed.
  const challenge = dailyChallenge(today(), games.filter((g) => g.daily).map((g) => g.id))
  const daily = params.get('daily') === challenge.day && id === challenge.gameId && seed === challenge.seed ? challenge.day : undefined
  const gameId = entry?.meta.id
  usePageMeta(entry ? gameTitle(entry.meta) : null, entry ? gameDescription(entry.meta) : null, `/play/${id ?? ''}`)
  const shellRef = useRef<HTMLElement>(null)
  const [favorite, setFavorite] = useState(false)
  const [locked, setLocked] = useState(false)
  const [dailyWin, setDailyWin] = useState<GameResult | null>(null)
  const [coinsWon, setCoinsWon] = useState(0)
  const [lastRun, setLastRun] = useState<{ score: number; won: boolean; passed?: boolean } | null>(null)
  // Levels: only for the score-chase games, and never for a daily challenge or a friend's challenge link.
  const leveled = !!gameId && isLeveled(gameId) && !daily && !incoming
  const [level, setLevel] = useState(1)
  const [run, setRun] = useState(0)
  const [cleared, setCleared] = useState(0)

  useEffect(() => {
    setLastRun(null)
    setDailyWin(null)
  }, [seed, gameId, level, run])
  useEffect(() => {
    if (!gameId || !isLeveled(gameId)) return
    const best = readCleared()[gameId] ?? 0
    setCleared(best)
    setLevel(best + 1)
    setRun(0)
  }, [gameId])

  // The lock never outlives the game page, and leaving full screen by the browser's own gesture unlocks too.
  useEffect(() => {
    if (!locked) return
    void lockScreen()
    const onFs = () => {
      if (!document.fullscreenElement) setLocked(false)
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      void unlockScreen()
    }
  }, [locked])

  useEffect(() => {
    if (gameId) void db.favorites.get(gameId).then(Boolean).then(setFavorite)
  }, [gameId])

  useEffect(() => (shellRef.current ? attachGameSound(shellRef.current) : undefined), [gameId])
  useEffect(() => (shellRef.current ? attachGameEffects(shellRef.current) : undefined), [gameId])

  const finish = useCallback(
    (result: GameResult) => {
      if (gameId) void recordPlay(gameId, result, daily)
      if (daily) setDailyWin(result)
      const passed = leveled && gameId ? levelCleared(gameId, level, result) : undefined
      if (passed && gameId) {
        saveCleared(gameId, level)
        setCleared((c) => Math.max(c, level))
      }
      setLastRun({ score: result.score, won: !!result.won, passed })
      setCoinsWon(coinsFor({ won: result.won, daily }))
    },
    [gameId, daily, leveled, level],
  )

  if (!entry) return <Navigate to="/" replace />
  const { meta, Component: Game } = entry

  return (
    <main id="main" className={`play-page${locked ? ' locked' : ''}`} data-category={meta.category}>
      <div className="play-head">
        <Link to="/" className="back">
          <ArrowLeft />
          Back to arcade
        </Link>
        <div className="play-head-tools">
        <HowToPlay meta={meta} />
        <SoundToggle />
        <button className="icon-btn lock-btn" aria-label="Fit to screen and lock" onClick={() => setLocked(true)}>
          <Lock />
        </button>
        <button
          className="icon-btn"
          aria-label="Toggle favorite"
          onClick={async () => {
            await toggleFavorite(meta.id)
            setFavorite((x) => !x)
          }}
        >
          <Heart fill={favorite ? 'currentColor' : 'none'} />
        </button>
        </div>
      </div>
      <div className="play-title">
        <p className="eyebrow">{daily ? `Daily challenge · ${meta.category}` : meta.category}</p>
        <h1>{meta.title}</h1>
        {computer && !daily && !incoming ? <p role="status">You are playing {computerLabel(computer)}. No one else was waiting.</p> : null}
        {incoming ? (
          <p className="challenge-banner" role="note">
            {incoming.from ?? 'A friend'} {incoming.won ? 'won this with' : 'scored'} {incoming.beat.toLocaleString()} on this puzzle. Can you beat it?
          </p>
        ) : (
          <p>{meta.description}</p>
        )}
      </div>
      {locked ? (
        <button className="unlock-btn" aria-label="Unlock screen" onClick={() => setLocked(false)}>
          <Unlock size={16} /> Unlock
        </button>
      ) : null}
      {leveled && gameId ? (
        <LevelBar
          gameId={gameId}
          level={level}
          cleared={cleared}
          last={lastRun && lastRun.passed !== undefined ? { score: lastRun.score, passed: lastRun.passed } : null}
          onPick={setLevel}
          onNext={() => setLevel((n) => n + 1)}
          onRetry={() => setRun((n) => n + 1)}
        />
      ) : null}
      <section className="game-shell" ref={shellRef}>
        <GameBoundary key={meta.id}>
          <Suspense fallback={<p className="game-help">Loading {meta.title}…</p>}>
            <Game key={`${seed ?? ''}:${level}:${run}`} onFinish={finish} seed={seed} level={leveled ? level : undefined} computer={computer ?? undefined} />
          </Suspense>
        </GameBoundary>
      </section>
      {coinsWon > 0 ? <p className="coin-earned" aria-live="polite">+{coinsWon} coins earned</p> : null}
      {meta.challenge && lastRun && seed ? (
        <div className="challenge-panel" aria-label="Challenge a friend">
          {incoming ? <p role="status">{verdictText(verdict(lastRun, { score: incoming.beat, won: incoming.won }), lastRun.score, incoming)}</p> : null}
          <ShareButton
            label={incoming ? 'Challenge back' : 'Challenge a friend'}
            text={shareChallenge(meta.title, lastRun, location.origin + challengePath(meta.id, seed, lastRun, getNick()))}
          />
        </div>
      ) : null}
      {lastRun && !meta.challenge && !(daily && dailyWin) ? <ShareButton label="Share score" text={shareScore(meta.title, lastRun, `${location.origin}/play/${meta.id}`)} /> : null}
      {daily && dailyWin ? <ShareButton text={shareDaily(meta.title, daily, dailyWin.score, dailyWin.durationMs)} /> : null}
      <p className="game-help">Keyboard and touch controls supported · Progress is saved on this device</p>
      <div className="play-more">
        <GameRow title="More like this" blurb={`More ${meta.category.toLowerCase()} games`} games={games.filter((g) => g.category === meta.category && g.id !== meta.id).slice(0, 6)} />
      </div>
      <GameAbout meta={meta} />
    </main>
  )
}
