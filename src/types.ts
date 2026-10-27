export type GameId = 'neon-merge' | 'memory-grid' | 'pulse-tap'
export type GameMeta = { id:GameId; title:string; description:string; category:string; accent:string; glyph:string; estimated:string }
export type GameProgress = { gameId:GameId; highScore:number; plays:number; lastPlayed:string }
