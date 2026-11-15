import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 180,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.mm-board',
  meta: {
    id: 'mole-mash',
    title: 'Mole Mash',
    description: 'Whack the moles before they duck. Stars score big, bombs cost you. 45 seconds, and it speeds up.',
    category: 'Arcade',
    accent: 'from-amber-400 to-lime-500',
    glyph: '🐹',
    estimated: '1 min',
  },
  Component: lazy(() => import('../MoleMash').then((m) => ({ default: m.MoleMash }))),
} satisfies CatalogEntry
