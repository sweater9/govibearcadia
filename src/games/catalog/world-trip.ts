import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 300,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.wt-board',
  meta: {
    id: 'world-trip',
    title: 'World Trip',
    description: 'Claim city stops, collect visitor fees and make deals on one device for 2 to 6 players, on one device or online.',
    category: 'Strategy',
    original: true,
    accent: 'from-sky-500 to-amber-500',
    glyph: '✈',
    estimated: '25–45 min',
  },
  Component: lazy(() => import('../WorldTrip').then((m) => ({ default: m.WorldTrip }))),
} satisfies CatalogEntry
