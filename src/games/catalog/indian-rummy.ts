import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 320,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.rm-hand',
  meta: {
    id: 'indian-rummy',
    title: 'Indian Rummy',
    description: 'The 13-card classic: make a pure sequence, a second sequence and sets, then declare. Play one to three computers.',
    category: 'Strategy',
    accent: 'from-emerald-600 to-amber-500',
    glyph: '🃏',
    estimated: '10–20 min',
  },
  Component: lazy(() => import('../Rummy').then((m) => ({ default: m.Rummy }))),
} satisfies CatalogEntry
