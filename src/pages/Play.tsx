import { ArrowLeft, Heart } from 'lucide-react'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { GameBoundary } from '../components/GameBoundary'
import { getGame } from '../games/registry'
import { db, recordPlay, toggleFavorite } from '../lib/db'
import type { GameResult } from '../types'

export function Play() {
  const { id } = useParams()
  const entry = getGame(id)
  const gameId = entry?.meta.id
  const [favorite, setFavorite] = useState(false)

  useEffect(() => {
    if (gameId) void db.favorites.get(gameId).then(Boolean).then(setFavorite)
  }, [gameId])

  const finish = useCallback(
    (result: GameResult) => {
      if (gameId) void recordPlay(gameId, result)
    },
    [gameId],
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
        <p className="eyebrow">{meta.category}</p>
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
      </div>
      <section className="game-shell">
        <GameBoundary key={meta.id}>
          <Suspense fallback={<p className="game-help">Loading {meta.title}…</p>}>
            <Game onFinish={finish} />
          </Suspense>
        </GameBoundary>
      </section>
      <p className="game-help">Keyboard and touch controls supported · Progress is saved on this device</p>
    </main>
  )
}
