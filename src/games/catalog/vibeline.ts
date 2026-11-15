import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 220,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.vl',
  meta: {
    id: 'vibeline',
    title: 'VibeLine',
    description: 'Draw one line through 1, 2, 3… in order and fill every square.',
    category: 'Puzzle',
    original: true,
    accent: 'from-violet-500 to-cyan-400',
    glyph: '〰',
    estimated: '2–5 min',
    daily: true,
    challenge: true,
  },
  Component: lazy(() => import('../VibeLine').then((m) => ({ default: m.VibeLine }))),
} satisfies CatalogEntry
