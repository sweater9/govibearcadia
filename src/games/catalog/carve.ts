import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 240,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.cv',
  meta: {
    id: 'carve',
    title: 'Carve',
    description: 'Cut the grid into rectangles, each one as large as the number inside it.',
    category: 'Logic',
    accent: 'from-emerald-400 to-sky-600',
    glyph: '▦',
    estimated: '3–8 min',
    daily: true,
    challenge: true,
  },
  Component: lazy(() => import('../Carve').then((m) => ({ default: m.Carve }))),
} satisfies CatalogEntry
