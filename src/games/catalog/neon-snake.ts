import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 50,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.snake-board',
  meta: {
    id: 'neon-snake',
    title: 'Neon Snake',
    description: 'Eat the signals, grow the trail, never touch yourself.',
    category: 'Retro',
    accent: 'from-lime-400 to-green-600',
    glyph: '∿',
    estimated: '2–6 min',
  },
  Component: lazy(() => import('../NeonSnake').then((m) => ({ default: m.NeonSnake }))),
} satisfies CatalogEntry
