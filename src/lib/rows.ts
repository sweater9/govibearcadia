import type { GameMeta } from '../types'

/** Curated "what do you feel like playing" shelves for the home page. Ids must exist in the registry (a test checks). */
export type Shelf = { id: string; title: string; blurb: string; ids: readonly string[] }

export const SHELVES: readonly Shelf[] = [
  { id: 'quick', title: '5-minute fun', blurb: 'One quick round on a break', ids: ['pulse-tap', 'tic-tac-toe', 'memory-grid', 'daily-word', 'neon-pong', 'vibeline', 'neon-merge'] },
  { id: 'brain', title: 'Train your brain', blurb: 'Logic, memory and patience', ids: ['sudoku-master', 'minesweeper', 'twofold', 'carve', 'color-sort'] },
  { id: 'friends', title: 'With friends', blurb: 'Online rooms or one shared screen', ids: ['connect-four', 'checkers', 'battleship', 'world-trip', 'ludo'] },
  { id: 'cards', title: 'Cards and table games', blurb: 'Play against the computer', ids: ['indian-rummy', 'blackjack', 'poker', 'taiwanese-mahjong'] },
  { id: 'heritage', title: 'Timeless classics', blurb: 'Traditional games from around the world', ids: ['ghata-bara', 'aadu-puli-attam', 'pallanguzhi', 'carrom'] },
  { id: 'arcade', title: 'Arcade rush', blurb: 'Fast reflexes, high scores', ids: ['neon-snake', 'brick-breaker', 'space-defender', 'gravity-flip'] },
]

/** A shelf's games, in shelf order, skipping any id the catalogue does not have. */
export function shelfGames(shelf: Shelf, games: readonly GameMeta[]): GameMeta[] {
  return shelf.ids.map((id) => games.find((g) => g.id === id)).filter((g): g is GameMeta => !!g)
}
