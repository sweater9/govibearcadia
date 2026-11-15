import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 150,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.tr-pad',
  meta: {
    id: 'traffic-dodger',
    title: 'Traffic Dodger',
    description: 'Weave through oncoming traffic on a four-lane road. It gets faster the longer you last.',
    category: 'Arcade',
    accent: 'from-sky-400 to-fuchsia-500',
    glyph: '🚗',
    estimated: '1–5 min',
  },
  Component: lazy(() => import('../TrafficDodger').then((m) => ({ default: m.TrafficDodger }))),
} satisfies CatalogEntry
