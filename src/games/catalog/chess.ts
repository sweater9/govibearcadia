import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 350,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.ch-setup',
  meta: {
    id: 'chess',
    title: 'Chess',
    description: 'The full game of chess against the computer: castling, en passant, promotion, three levels. Play White or Black.',
    category: 'Strategy',
    accent: 'from-slate-700 to-amber-400',
    glyph: '♞',
    estimated: '10–40 min',
  },
  Component: lazy(() => import('../Chess').then((m) => ({ default: m.Chess }))),
} satisfies CatalogEntry
