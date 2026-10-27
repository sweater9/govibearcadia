import { Heart, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { GameMeta } from '../types'

export function GameCard({game,favorite,onFavorite}:{game:GameMeta;favorite:boolean;onFavorite:()=>void}){
  return <article className="game-card group">
    <div className={`game-art bg-gradient-to-br ${game.accent}`}><span>{game.glyph}</span><div className="scanlines" /></div>
    <div className="p-5"><div className="mb-2 flex items-start justify-between gap-3"><div><p className="eyebrow">{game.category} · {game.estimated}</p><h3 className="mt-1 text-xl font-bold">{game.title}</h3></div><button className="icon-btn" aria-label={`${favorite?'Remove':'Add'} ${game.title} ${favorite?'from':'to'} favorites`} onClick={onFavorite}><Heart size={18} fill={favorite?'currentColor':'none'} /></button></div><p className="min-h-12 text-sm text-white/55">{game.description}</p><Link className="play-link" to={`/play/${game.id}`}>Play now <Play size={15} fill="currentColor" /></Link></div>
  </article>
}
