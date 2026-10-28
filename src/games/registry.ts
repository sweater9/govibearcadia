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
]

export const getGame = (id?: string): GameEntry | undefined => registry.find((entry) => entry.meta.id === id)
