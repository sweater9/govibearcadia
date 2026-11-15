import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 60,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.csort-tubes',
  meta: {
    id: 'color-sort',
    title: 'Color Sort',
    description: 'Pour the glowing balls until every tube holds a single color.',
    category: 'Puzzle',
    accent: 'from-pink-500 to-amber-400',
    glyph: '▥',
    estimated: '3–8 min',
    daily: true,
    challenge: true,
  },
  Component: lazy(() => import('../ColorSort').then((m) => ({ default: m.ColorSort }))),
} satisfies CatalogEntry
