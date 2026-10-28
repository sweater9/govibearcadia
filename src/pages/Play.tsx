import { ArrowLeft, Heart } from 'lucide-react'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { GameBoundary } from '../components/GameBoundary'
import { getGame } from '../games/registry'
import { games } from '../data/games'
import { db, recordPlay, toggleFavorite } from '../lib/db'
import { dailyChallenge, today } from '../lib/passport'
import type { GameResult } from '../types'

export function Play() {
  const { id } = useParams()
  // `?seed=` makes a game deterministic: the same seed always deals the same game. Daily challenges will use it.
  const params = useSearchParams()[0]
  const seed = params.get('seed') ?? undefined
  // `?daily=<day>` counts only when it is today's challenge for this game, with the challenge's seed.
  const challenge = dailyChallenge(today(), games.filter((g) => g.daily).map((g) => g.id))
  const daily = params.get('daily') === challenge.day && id === challenge.gameId && seed === challenge.seed ? challenge.day : undefined
  const entry = getGame(id)
  const gameId = entry?.meta.id
  const [favorite, setFavorite] = useState(false)

  useEffect(() => {
    if (gameId) void db.favorites.get(gameId).then(Boolean).then(setFavorite)
  }, [gameId])

  const finish = useCallback(
    (result: GameResult) => {
      if (gameId) void recordPlay(gameId, result, daily)
    },
    [gameId, daily],
  )

  if (!entry) return <Navigate to="/" replace />
  const { meta, Component: Game } = entry

  return (
    <main className="play-page">
      <div className="play-head">
        <Link to="/" className="back">
          <ArrowLeft />
          Back to arcade
        </Link>
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
      <div className="play-title">
        <p className="eyebrow">{daily ? `Daily challenge · ${meta.category}` : meta.category}</p>
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
      </div>
      <section className="game-shell">
        <GameBoundary key={meta.id}>
          <Suspense fallback={<p className="game-help">Loading {meta.title}…</p>}>
            <Game key={seed ?? ''} onFinish={finish} seed={seed} />
          </Suspense>
        </GameBoundary>
      </section>
      <p className="game-help">Keyboard and touch controls supported · Progress is saved on this device</p>
    </main>
  )
}
