import { ArrowRight, Ban, CloudOff, Gift, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GameCard } from '../components/GameCard'
import { GameRow } from '../components/GameRow'
import { SHELVES, shelfGames } from '../lib/rows'
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
          <h1>The arcade with no ads.</h1>
          <p className="lead">{games.length} free games for quick escapes and long streaks. No ads, no sign-up. Play alone, or with friends online or on one device.</p>
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
      <ul className="promise" aria-label="What you get">
        <li><Ban size={20} strokeWidth={1.5} /><span><b>No ads</b>Never, not between games</span></li>
        <li><Gift size={20} strokeWidth={1.5} /><span><b>No sign-up</b>Press play, that is it</span></li>
        <li><CloudOff size={20} strokeWidth={1.5} /><span><b>Works offline</b>Once loaded, no connection needed</span></li>
        <li><ShieldCheck size={20} strokeWidth={1.5} /><span><b>Yours to keep</b>Progress stays on your device</span></li>
      </ul>
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
      <div className="shelves">
        {progress.length ? (
          <GameRow title="Recently played" blurb="Pick up where you left off" games={progress.slice(0, 8).map((p) => games.find((g) => g.id === p.gameId)).filter((g): g is (typeof games)[number] => !!g)} />
        ) : null}
        {SHELVES.map((sh) => (
          <GameRow key={sh.id} title={sh.title} blurb={sh.blurb} games={shelfGames(sh, games)} />
        ))}
      </div>
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
      <section className="versus" aria-label="How GoVibeArcadia differs">
        <p className="eyebrow">Why it feels different</p>
        <h2>Built to be played, not to sell ads</h2>
        <div className="versus-grid">
          <div className="versus-us">
            <h3>GoVibeArcadia</h3>
            <ul>
              <li>No ads, ever, so nothing interrupts a round</li>
              <li>No account: your scores, coins and streaks stay on your device</li>
              <li>Every game is made and tested by us, nothing reskinned</li>
              <li>Installs like an app and plays offline</li>
              <li>No trackers and no third-party requests</li>
            </ul>
          </div>
          <div className="versus-them">
            <h3>Many free game sites</h3>
            <ul>
              <li>Ads between rounds, and sometimes during play</li>
              <li>Progress sits behind a sign-in</li>
              <li>Thousands of games of uneven quality</li>
              <li>Need a connection for every game</li>
              <li>Third-party ad and analytics networks</li>
            </ul>
          </div>
        </div>
        <p className="muted"><Link to="/about">What we store and what we send</Link></p>
      </section>
    </main>
  )
}
