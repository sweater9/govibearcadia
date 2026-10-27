import { ArrowLeft, Heart } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { games } from '../data/games'
import { MemoryGrid } from '../games/MemoryGrid'
import { NeonMerge } from '../games/NeonMerge'
import { PulseTap } from '../games/PulseTap'
import { db, recordPlay, toggleFavorite } from '../lib/db'
import type { GameId } from '../types'
const components={ 'neon-merge':NeonMerge,'memory-grid':MemoryGrid,'pulse-tap':PulseTap }
export function Play(){const {id}=useParams();const game=games.find(g=>g.id===id);const [favorite,setFavorite]=useState(false);useEffect(()=>{if(game)void db.favorites.get(game.id).then(Boolean).then(setFavorite)},[game]);const finish=useCallback((score:number)=>{if(game)void recordPlay(game.id,score)},[game]);if(!game)return <Navigate to="/" replace/>;const Game=components[game.id];return <main className="play-page"><div className="play-head"><Link to="/" className="back"><ArrowLeft/>Back to arcade</Link><button className="icon-btn" aria-label="Toggle favorite" onClick={async()=>{await toggleFavorite(game.id as GameId);setFavorite(x=>!x)}}><Heart fill={favorite?'currentColor':'none'}/></button></div><div className="play-title"><p className="eyebrow">{game.category}</p><h1>{game.title}</h1><p>{game.description}</p></div><section className="game-shell"><Game onFinish={finish}/></section><p className="game-help">Keyboard and touch controls supported · Progress is saved on this device</p></main>}
