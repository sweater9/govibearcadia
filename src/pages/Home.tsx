import { ArrowRight, CloudOff, ShieldCheck, Sparkles, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GameCard } from '../components/GameCard'
import { categories, games } from '../data/games'
import { db, toggleFavorite } from '../lib/db'
import type { GameId, GameProgress } from '../types'

export function Home() {
  const [favorites, setFavorites] = useState<GameId[]>([])
  const [progress, setProgress] = useState<GameProgress[]>([])
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setFavorites((await db.favorites.toArray()).map((x) => x.gameId))
    setProgress(await db.progress.orderBy('lastPlayed').reverse().toArray())
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return games.filter(
      (g) =>
        (filter === 'All' || g.category === filter) &&
        (!q || `${g.title} ${g.description} ${g.category}`.toLowerCase().includes(q)),
    )
  }, [filter, query])

  const recent = progress[0] && games.find((g) => g.id === progress[0].gameId)

  return (
    <main>
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-copy">
          <div className="pill">
            <Sparkles size={14} /> Independent. Instant. Yours.
          </div>
          <h1>
            Step into your
            <br />
            <span>next obsession.</span>
          </h1>
          <p>A premium browser arcade built for quick escapes and long streaks. No account. No tracking. Just play.</p>
          <div className="hero-actions">
            <Link className="primary-btn" to={`/play/${recent?.id ?? games[0].id}`}>
              {recent ? 'Continue playing' : 'Start playing'} <ArrowRight size={18} />
            </Link>
            <a className="secondary-btn" href="#library">
              Explore the arcade
            </a>
          </div>
          <div className="trust">
            <span>
              <CloudOff />
              Offline friendly
            </span>
            <span>
              <ShieldCheck />
              Progress stays local
            </span>
            <span>
              <Trophy />
              Personal bests
            </span>
          </div>
        </div>
        <div className="portal" aria-hidden="true">
          <div className="orbit orbit-a" />
          <div className="orbit orbit-b" />
          <div className="portal-core">
            <span>G</span>
            <small>ENTER ARCADIA</small>
          </div>
        </div>
      </section>
      {recent ? (
        <section className="continue">
          <div>
            <p className="eyebrow">Continue your run</p>
            <h2>{recent.title}</h2>
            <p>
              {progress[0].plays} plays · Best {progress[0].highScore.toLocaleString()}
            </p>
          </div>
          <Link className="primary-btn" to={`/play/${recent.id}`}>
            Jump back in <ArrowRight size={18} />
          </Link>
        </section>
      ) : null}
      <section id="library" className="library">
        <div className="section-head">
          <div>
            <p className="eyebrow">The collection</p>
            <h2>Pick your portal</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              aria-label="Search games"
              placeholder="Search games"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-cyan-300/60 sm:w-56"
            />
            <div className="filters">
              {categories.map((x) => (
                <button key={x} className={filter === x ? 'active' : ''} onClick={() => setFilter(x)}>
                  {x}
                </button>
              ))}
            </div>
          </div>
        </div>
        {visible.length ? (
          <div className="game-grid">
            {visible.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                favorite={favorites.includes(game.id)}
                onFavorite={async () => {
                  await toggleFavorite(game.id)
                  await load()
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-white/55" role="status">
            No games match “{query}”. Try a different word or clear the category filter.
          </p>
        )}
        <p className="phase-note">
          Phase 1 collection · {games.length} complete games, growing toward a 15-game arcade.
        </p>
      </section>
    </main>
  )
}
