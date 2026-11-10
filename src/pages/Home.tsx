import { ArrowRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GameCard } from '../components/GameCard'
import { categories, games } from '../data/games'
import { db, toggleFavorite } from '../lib/db'
import { dailyChallenge, today } from '../lib/passport'
import { usePageMeta } from '../lib/pageMeta'
import { InstallPrompt } from '../components/InstallPrompt'
import { recommend } from '../lib/recommend'
import { Thumbnail } from '../components/Thumbnail'
import type { GameId, GameProgress, PlayRecord } from '../types'

const HERO_TILES = [
  { id: 'neon-merge', cat: '#8FA8FF', bg: '#3d2a1e' },
  { id: 'connect-four', cat: '#6FD3E8', bg: '#3c291e' },
  { id: 'pulse-tap', cat: '#d4707c', bg: '#2B1620' },
  { id: 'neon-snake', cat: '#C9A6FF', bg: '#3c2a1e' },
] as const

export function Home() {
  usePageMeta(null, null, '/')
  const [favorites, setFavorites] = useState<GameId[]>([])
  const [progress, setProgress] = useState<GameProgress[]>([])
  const [history, setHistory] = useState<PlayRecord[] | null>(null)
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setFavorites((await db.favorites.toArray()).map((x) => x.gameId))
    setProgress(await db.progress.orderBy('lastPlayed').reverse().toArray())
    setHistory(await db.history.toArray())
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

  const picks = useMemo(() => (history ? recommend(games, history, favorites, new Date()) : []), [history, favorites])
  const challenge = dailyChallenge(today(), games.filter((g) => g.daily).map((g) => g.id))
  const challengeGame = games.find((g) => g.id === challenge.gameId)!
  const recent = progress[0] && games.find((g) => g.id === progress[0].gameId)

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="trust">No tracking, no account, works offline once loaded, progress stays on your device.</p>
          <h1>Step into your next obsession.</h1>
          <p className="lead">{games.length} free games for quick escapes and long streaks. No ads, no sign-up. Play alone, or with friends on one device.</p>
          <div className="hero-actions">
            <Link className="primary-btn" to={`/play/${recent?.id ?? games[0].id}`}>
              {recent ? 'Continue playing' : 'Start playing'} <ArrowRight size={20} strokeWidth={1.5} />
            </Link>
            <a className="secondary-btn" href="#library">
              Explore the arcade
            </a>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          {HERO_TILES.map((t, i) => (
            <div key={t.id} className={`hero-tile hero-tile-${i}`} style={{ '--cat': t.cat, '--cat-bg': t.bg } as React.CSSProperties}>
              <Thumbnail id={t.id} />
            </div>
          ))}
        </div>
      </section>
      <div className="install-slot"><InstallPrompt /></div>
      <div className="today">
        <section className="home-daily daily-card" aria-label="Daily challenge">
          <div>
            <p className="eyebrow">Daily challenge · {challenge.day}</p>
            <h2>{challengeGame.title}</h2>
            <p>Same puzzle for everyone today. Win it for +50 XP and to keep your streak.</p>
          </div>
          <Link className="primary-btn" to={`/play/${challenge.gameId}?seed=${challenge.seed}&daily=${challenge.day}`}>
            Play today's challenge <ArrowRight size={20} strokeWidth={1.5} />
          </Link>
        </section>
        <section className="home-daily" aria-label="Play online">
          <div>
            <p className="eyebrow">Play with a friend</p>
            <h2>Private online rooms</h2>
            <p>Connect Four, Tic-Tac-Toe, Checkers or Battleship. Send a code, no account needed.</p>
          </div>
          <div className="today-links">
            <Link className="secondary-btn" to="/online">
              Play online <ArrowRight size={20} strokeWidth={1.5} />
            </Link>
            <Link className="secondary-btn" to="/leaderboard">
              Leaderboards
            </Link>
          </div>
        </section>
      </div>
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
            Jump back in <ArrowRight size={20} strokeWidth={1.5} />
          </Link>
        </section>
      ) : null}
      {history?.length && picks.length ? (
        <section className="recs" aria-label="Recommended for you">
          <p className="eyebrow">Recommended for you</p>
          <ul>
            {picks.map((p) => (
              <li key={p.gameId}>
                <Link to={`/play/${p.gameId}`}>
                  <strong>{games.find((g) => g.id === p.gameId)?.title}</strong>
                  <small>{p.reason}</small>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section id="library" className="library">
        <div className="section-head">
          <div>
            <p className="eyebrow">The collection</p>
            <h2>Pick your portal</h2>
          </div>
          <div className="library-tools">
            <input
              type="search"
              aria-label="Search games"
              placeholder="Search games"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search"
            />
            <div className="filters">
              {categories.map((x) => (
                <button key={x} className={filter === x ? 'active' : ''} onClick={() => setFilter(x)} aria-pressed={filter === x}>
                  {x} <span className="count">{x === 'All' ? games.length : games.filter((g) => g.category === x).length}</span>
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
          <p className="muted" role="status">
            No games match “{query}”. Try a different word or clear the category filter.
          </p>
        )}
        <p className="phase-note">
          {games.length} games · free, no account, and they work offline once loaded.
        </p>
      </section>
    </main>
  )
}
