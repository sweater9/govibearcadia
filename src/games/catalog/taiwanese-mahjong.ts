import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 290,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.mj-setup',
  meta: {
    id: 'taiwanese-mahjong',
    title: 'Taiwanese Mahjong',
    description: '16-tile Mahjong with flowers and tai scoring, against three computers.',
    category: 'Strategy',
    accent: 'from-emerald-500 to-teal-600',
    glyph: '🀄',
    estimated: '20–45 min',
  },
  Component: lazy(() => import('../Mahjong').then((m) => ({ default: m.Mahjong }))),
} satisfies CatalogEntry
