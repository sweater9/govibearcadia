import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 230,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.tf',
  meta: {
    id: 'twofold',
    title: 'Twofold',
    description: 'Fill the grid with suns and moons: no three alike in a row, and every line balanced.',
    category: 'Logic',
    accent: 'from-amber-400 to-indigo-600',
    glyph: '☀',
    estimated: '3–8 min',
    daily: true,
    challenge: true,
  },
  Component: lazy(() => import('../Twofold').then((m) => ({ default: m.Twofold }))),
} satisfies CatalogEntry
