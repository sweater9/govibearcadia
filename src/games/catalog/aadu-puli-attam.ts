import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 260,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.ap-board',
  meta: {
    id: 'aadu-puli-attam',
    title: 'Aadu Puli Attam',
    description: 'The traditional Tamil hunt game: three tigers face a united herd of fifteen goats.',
    category: 'Strategy',
    accent: 'from-amber-500 to-rose-600',
    glyph: '🐯',
    estimated: '10–20 min',
  },
  Component: lazy(() => import('../AaduPuliAttam').then((m) => ({ default: m.AaduPuliAttam }))),
} satisfies CatalogEntry
