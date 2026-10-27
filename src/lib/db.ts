import Dexie, { type EntityTable } from 'dexie'
import type { GameId, GameProgress } from '../types'

class ArcadeDB extends Dexie {
  progress!: EntityTable<GameProgress, 'gameId'>
  favorites!: EntityTable<{gameId:GameId;addedAt:string}, 'gameId'>
  constructor(){ super('govibearcadia'); this.version(1).stores({progress:'gameId,lastPlayed',favorites:'gameId,addedAt'}) }
}
export const db = new ArcadeDB()
export async function recordPlay(gameId:GameId, score:number){
  const current=await db.progress.get(gameId)
  await db.progress.put({gameId,highScore:Math.max(score,current?.highScore??0),plays:(current?.plays??0)+1,lastPlayed:new Date().toISOString()})
}
export async function toggleFavorite(gameId:GameId){ const found=await db.favorites.get(gameId); if(found) await db.favorites.delete(gameId); else await db.favorites.put({gameId,addedAt:new Date().toISOString()}) }
