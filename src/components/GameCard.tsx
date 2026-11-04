import { Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ONLINE_GAME_LIST } from '../lib/online'
import type { GameMeta } from '../types'
import { Thumbnail } from './Thumbnail'

const ONLINE_IDS: readonly string[] = ONLINE_GAME_LIST.map((g) => g.id)

export function GameCard({ game, favorite, onFavorite }: { game: GameMeta; favorite: boolean; onFavorite: () => void }) {
  const online = ONLINE_IDS.includes(game.id)
  return (
    <article className="game-card" data-category={game.category}>
      <div className="thumb">
        <Thumbnail id={game.id} />
      </div>
      <div className="card-meta">
        <span className="label">
          {game.category} · {game.estimated}
        </span>
        <span className="badges">
          {game.original ? <em className="badge badge-original">Original</em> : null}
          {online ? <em className="badge badge-online online-badge">Online</em> : null}
        </span>
      </div>
      <div className="card-title">
        <h3>
          <Link className="card-link" to={`/play/${game.id}`}>
            {game.title}
          </Link>
        </h3>
        <button className="icon-btn" aria-label={`${favorite ? 'Remove' : 'Add'} ${game.title} ${favorite ? 'from' : 'to'} favorites`} onClick={onFavorite}>
          <Heart size={20} strokeWidth={1.5} fill={favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <p className="card-desc">{game.description}</p>
    </article>
  )
}
