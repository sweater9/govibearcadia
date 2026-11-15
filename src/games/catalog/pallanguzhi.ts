import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 270,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.pg-table',
  meta: {
    id: 'pallanguzhi',
    title: 'Pallanguzhi',
    description: 'The traditional seed-sowing game of Karnataka (Ali Guli Mane): relay sowing, Saada captures and piggy pits.',
    category: 'Strategy',
    accent: 'from-amber-500 to-fuchsia-500',
    glyph: '◉',
    estimated: '10–25 min',
  },
  Component: lazy(() => import('../Pallanguzhi').then((m) => ({ default: m.Pallanguzhi }))),
} satisfies CatalogEntry
