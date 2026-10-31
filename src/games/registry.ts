import { lazy, type ComponentType } from 'react'
import type { GameMeta, GameProps } from '../types'

export type GameEntry = { meta: GameMeta; Component: ComponentType<GameProps> }

/**
 * Single source of truth for games. To add one: create the component, then add one entry here.
 * Components are lazy-loaded so each game becomes its own chunk and loads on demand.
 */
export const registry: GameEntry[] = [
  {
    meta: {
      id: 'neon-merge',
      title: 'Neon Merge',
      description: 'Slide luminous tiles and chase the 2048 core.',
      category: 'Puzzle',
      accent: 'from-violet-500 to-fuchsia-500',
      glyph: '◇',
      estimated: '3–8 min',
    },
    Component: lazy(() => import('./NeonMerge').then((m) => ({ default: m.NeonMerge }))),
  },
  {
    meta: {
      id: 'memory-grid',
      title: 'Memory Grid',
      description: 'Match every signal in the fewest possible moves.',
      category: 'Focus',
      accent: 'from-cyan-400 to-blue-600',
      glyph: '✦',
      estimated: '2–4 min',
      daily: true,
    },
    Component: lazy(() => import('./MemoryGrid').then((m) => ({ default: m.MemoryGrid }))),
  },
  {
    meta: {
      id: 'pulse-tap',
      title: 'Pulse Tap',
      description: 'Thirty seconds. One moving target. Stay sharp.',
      category: 'Arcade',
      accent: 'from-rose-500 to-orange-400',
      glyph: '◎',
      estimated: '30 sec',
    },
    Component: lazy(() => import('./PulseTap').then((m) => ({ default: m.PulseTap }))),
  },
  {
    meta: {
      id: 'minesweeper',
      title: 'Minesweeper',
      description: 'Clear the field without touching a mine. Flag, deduce, survive.',
      category: 'Logic',
      accent: 'from-emerald-400 to-teal-600',
      glyph: '✹',
      estimated: '3–10 min',
      daily: true,
    },
    Component: lazy(() => import('./Minesweeper').then((m) => ({ default: m.Minesweeper }))),
  },
  {
    meta: {
      id: 'neon-snake',
      title: 'Neon Snake',
      description: 'Eat the signals, grow the trail, never touch yourself.',
      category: 'Retro',
      accent: 'from-lime-400 to-green-600',
      glyph: '∿',
      estimated: '2–6 min',
    },
    Component: lazy(() => import('./NeonSnake').then((m) => ({ default: m.NeonSnake }))),
  },
  {
    meta: {
      id: 'color-sort',
      title: 'Color Sort',
      description: 'Pour the glowing balls until every tube holds a single color.',
      category: 'Puzzle',
      accent: 'from-pink-500 to-amber-400',
      glyph: '▥',
      estimated: '3–8 min',
      daily: true,
    },
    Component: lazy(() => import('./ColorSort').then((m) => ({ default: m.ColorSort }))),
  },
  {
    meta: {
      id: 'connect-four',
      title: 'Connect Four',
      description: 'Drop discs and line up four before the computer does.',
      category: 'Strategy',
      accent: 'from-red-500 to-yellow-400',
      glyph: '◍',
      estimated: '3–8 min',
    },
    Component: lazy(() => import('./ConnectFour').then((m) => ({ default: m.ConnectFour }))),
  },
  {
    meta: {
      id: 'tic-tac-toe',
      title: 'Tic-Tac-Toe',
      description: 'Three in a row. Outsmart the computer, or play a friend online.',
      category: 'Strategy',
      accent: 'from-cyan-400 to-violet-500',
      glyph: '✕',
      estimated: '1–2 min',
    },
    Component: lazy(() => import('./TicTacToe').then((m) => ({ default: m.TicTacToe }))),
  },
  {
    meta: {
      id: 'checkers',
      title: 'Checkers',
      description: 'Jump, capture and crown kings against the computer, or a friend online.',
      category: 'Strategy',
      accent: 'from-red-500 to-violet-600',
      glyph: '⛀',
      estimated: '8–20 min',
    },
    Component: lazy(() => import('./Checkers').then((m) => ({ default: m.Checkers }))),
  },
  {
    meta: {
      id: 'battleship',
      title: 'Battleship',
      description: 'Hunt the hidden fleet. Beat the computer, or a friend online.',
      category: 'Strategy',
      accent: 'from-sky-500 to-indigo-600',
      glyph: '⚓',
      estimated: '5–12 min',
    },
    Component: lazy(() => import('./Battleship').then((m) => ({ default: m.Battleship }))),
  },
  {
    meta: {
      id: 'daily-word',
      title: 'Daily Word',
      description: 'Six guesses to find the word of the day. Same word for everyone.',
      category: 'Word',
      accent: 'from-emerald-400 to-lime-500',
      glyph: 'Ⓦ',
      estimated: '2–5 min',
      daily: true,
    },
    Component: lazy(() => import('./DailyWord').then((m) => ({ default: m.DailyWord }))),
  },
  {
    meta: {
      id: 'brick-breaker',
      title: 'Brick Breaker',
      description: 'Steer the ball, smash the wall, keep it in play.',
      category: 'Arcade',
      accent: 'from-orange-500 to-pink-500',
      glyph: '▤',
      estimated: '3–6 min',
    },
    Component: lazy(() => import('./BrickBreaker').then((m) => ({ default: m.BrickBreaker }))),
  },
  {
    meta: {
      id: 'neon-pong',
      title: 'Neon Pong',
      description: 'Rally against the machine. First to seven wins.',
      category: 'Arcade',
      accent: 'from-cyan-400 to-violet-600',
      glyph: '◐',
      estimated: '2–5 min',
    },
    Component: lazy(() => import('./NeonPong').then((m) => ({ default: m.NeonPong }))),
  },
  {
    meta: {
      id: 'sudoku-master',
      title: 'Sudoku Master',
      description: 'Fill the grid so every row, column and box holds 1 to 9.',
      category: 'Logic',
      accent: 'from-indigo-500 to-cyan-400',
      glyph: '▦',
      estimated: '5–20 min',
      daily: true,
    },
    Component: lazy(() => import('./SudokuMaster').then((m) => ({ default: m.SudokuMaster }))),
  },
  {
    meta: {
      id: 'space-defender',
      title: 'Space Defender',
      description: 'Hold the line against five waves of descending invaders.',
      category: 'Arcade',
      accent: 'from-fuchsia-500 to-indigo-600',
      glyph: '▲',
      estimated: '4–8 min',
    },
    Component: lazy(() => import('./SpaceDefender').then((m) => ({ default: m.SpaceDefender }))),
  },
  {
    meta: {
      id: 'gravity-flip',
      title: 'Gravity Flip',
      description: 'Flip gravity to reach the exit in as few moves as you can. Ten handmade levels.',
      category: 'Platform Puzzle',
      accent: 'from-cyan-400 to-violet-600',
      glyph: '⇅',
      estimated: '5–10 min',
    },
    Component: lazy(() => import('./GravityFlip').then((m) => ({ default: m.GravityFlip }))),
  },
  {
    meta: {
      id: 'vibeline',
      title: 'VibeLine',
      description: 'Draw one line through 1, 2, 3… in order and fill every square.',
      category: 'Original Puzzle',
      accent: 'from-violet-500 to-cyan-400',
      glyph: '〰',
      estimated: '2–5 min',
      daily: true,
    },
    Component: lazy(() => import('./VibeLine').then((m) => ({ default: m.VibeLine }))),
  },
  {
    meta: {
      id: 'twofold',
      title: 'Twofold',
      description: 'Fill the grid with suns and moons: no three alike in a row, and every line balanced.',
      category: 'Logic',
      accent: 'from-amber-400 to-indigo-600',
      glyph: '☀',
      estimated: '3–8 min',
      daily: true,
    },
    Component: lazy(() => import('./Twofold').then((m) => ({ default: m.Twofold }))),
  },
  {
    meta: {
      id: 'carve',
      title: 'Carve',
      description: 'Cut the grid into rectangles, each one as large as the number inside it.',
      category: 'Logic',
      accent: 'from-emerald-400 to-sky-600',
      glyph: '▦',
      estimated: '3–8 min',
      daily: true,
    },
    Component: lazy(() => import('./Carve').then((m) => ({ default: m.Carve }))),
  },
]

export const getGame = (id?: string): GameEntry | undefined => registry.find((entry) => entry.meta.id === id)
