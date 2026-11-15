import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 100,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.bs-board',
  meta: {
    id: 'battleship',
    title: 'Battleship',
    description: 'Hunt the hidden fleet. Beat the computer, or a friend online.',
    category: 'Strategy',
    accent: 'from-sky-500 to-indigo-600',
    glyph: '⚓',
    estimated: '5–12 min',
  },
  Component: lazy(() => import('../Battleship').then((m) => ({ default: m.Battleship }))),
} satisfies CatalogEntry
