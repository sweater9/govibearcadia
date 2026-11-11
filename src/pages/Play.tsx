import { ArrowLeft, Heart, Lock, Unlock } from 'lucide-react'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { GameBoundary } from '../components/GameBoundary'
import { getGame } from '../games/registry'
import { games } from '../data/games'
import { db, recordPlay, toggleFavorite } from '../lib/db'
import { SoundToggle } from '../components/SoundToggle'
import { attachGameSound } from '../lib/sound'
import { attachGameEffects } from '../lib/effects'
import { coinsFor } from '../lib/wallet'
import { lockScreen, unlockScreen } from '../lib/screenLock'
import { ShareButton } from '../components/ShareButton'
import { challengePath, parseChallenge, randomSeed, shareChallenge, verdict, verdictText } from '../lib/challenge'
import { getNick } from '../lib/online'
import { usePageMeta } from '../lib/pageMeta'
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
  const incoming = entry?.meta.challenge ? parseChallenge(params) : null
  // `?daily=<day>` counts only when it is today's challenge for this game, with the challenge's seed.
  const challenge = dailyChallenge(today(), games.filter((g) => g.daily).map((g) => g.id))
  const daily = params.get('daily') === challenge.day && id === challenge.gameId && seed === challenge.seed ? challenge.day : undefined
  const gameId = entry?.meta.id
  usePageMeta(entry ? `${entry.meta.title}: play free online · GoVibeArcadia` : null, entry ? `${entry.meta.description} Free to play in your browser: no ads, no sign-up, works offline.` : null, `/play/${id ?? ''}`)
  const shellRef = useRef<HTMLElement>(null)
  const [favorite, setFavorite] = useState(false)
  const [locked, setLocked] = useState(false)
  const [dailyWin, setDailyWin] = useState<GameResult | null>(null)
  const [coinsWon, setCoinsWon] = useState(0)
  const [lastRun, setLastRun] = useState<{ score: number; won: boolean } | null>(null)

  useEffect(() => setLastRun(null), [seed, gameId])

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
      if (daily && result.won) setDailyWin(result)
      setLastRun({ score: result.score, won: !!result.won })
      setCoinsWon(coinsFor({ won: result.won, daily }))
    },
    [gameId, daily],
  )

  if (!entry) return <Navigate to="/" replace />
  const { meta, Component: Game } = entry

  return (
    <main className={`play-page${locked ? ' locked' : ''}`}>
      <div className="play-head">
        <Link to="/" className="back">
          <ArrowLeft />
          Back to arcade
        </Link>
        <div className="play-head-tools">
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
      <section className="game-shell" ref={shellRef}>
        <GameBoundary key={meta.id}>
          <Suspense fallback={<p className="game-help">Loading {meta.title}…</p>}>
            <Game key={seed ?? ''} onFinish={finish} seed={seed} />
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
      {daily && dailyWin ? <ShareButton text={shareDaily(meta.title, daily, dailyWin.score, dailyWin.durationMs)} /> : null}
      <p className="game-help">Keyboard and touch controls supported · Progress is saved on this device</p>
    </main>
  )
}
