import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 310,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.ld-board',
  meta: {
    id: 'ludo',
    title: 'Ludo',
    description: 'Race four tokens round the board, capture rivals and get home first. Play the computer or friends on one device.',
    category: 'Strategy',
    accent: 'from-rose-500 to-amber-500',
    glyph: '🎲',
    estimated: '15–30 min',
  },
  Component: lazy(() => import('../Ludo').then((m) => ({ default: m.Ludo }))),
} satisfies CatalogEntry
