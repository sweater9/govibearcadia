import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 280,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.cm-setup',
  meta: {
    id: 'carrom',
    title: 'Carrom',
    description: 'Flick the striker, pocket your coins and cover the queen. Two or four players, or the computer.',
    category: 'Arcade',
    accent: 'from-amber-500 to-orange-600',
    glyph: '◎',
    estimated: '15–40 min',
  },
  Component: lazy(() => import('../Carrom').then((m) => ({ default: m.Carrom }))),
} satisfies CatalogEntry
