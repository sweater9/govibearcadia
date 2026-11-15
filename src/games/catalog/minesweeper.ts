import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 40,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.mines-grid',
  meta: {
    id: 'minesweeper',
    title: 'Minesweeper',
    description: 'Clear the field without touching a mine. Flag, deduce, survive.',
    category: 'Logic',
    accent: 'from-emerald-400 to-teal-600',
    glyph: '✹',
    estimated: '3–10 min',
    daily: true,
    challenge: true,
  },
  Component: lazy(() => import('../Minesweeper').then((m) => ({ default: m.Minesweeper }))),
} satisfies CatalogEntry
