import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 90,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.ck-board',
  meta: {
    id: 'checkers',
    title: 'Checkers',
    description: 'Jump, capture and crown kings against the computer, or a friend online.',
    category: 'Strategy',
    accent: 'from-red-500 to-violet-600',
    glyph: '⛀',
    estimated: '8–20 min',
  },
  Component: lazy(() => import('../Checkers').then((m) => ({ default: m.Checkers }))),
} satisfies CatalogEntry
