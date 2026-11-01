import { Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ONLINE_GAME_LIST } from '../lib/online'
import type { GameMeta } from '../types'

const ONLINE_IDS: readonly string[] = ONLINE_GAME_LIST.map((g) => g.id)

export function GameCard({game,favorite,onFavorite}:{game:GameMeta;favorite:boolean;onFavorite:()=>void}){
  return <article className="game-card group">
    <div className={`game-art bg-gradient-to-br ${game.accent}`}><span>{game.glyph}</span>{ONLINE_IDS.includes(game.id)?<em className="online-badge">Online</em>:null}<div className="scanlines" /></div>
    <div className="game-body"><div className="mb-2 flex items-start justify-between gap-3"><div><p className="eyebrow">{game.category} · {game.estimated}</p><h3 className="mt-1 text-xl font-bold"><Link className="card-link" to={`/play/${game.id}`}>{game.title}</Link></h3></div><button className="icon-btn" aria-label={`${favorite?'Remove':'Add'} ${game.title} ${favorite?'from':'to'} favorites`} onClick={onFavorite}><Heart size={18} fill={favorite?'currentColor':'none'} /></button></div><p className="text-sm text-white/55">{game.description}</p></div>
  </article>
}
