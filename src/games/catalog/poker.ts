import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 370,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.pk-table',
  meta: {
    id: 'poker',
    title: 'Poker',
    description: 'Texas Hold’em tournament against one to four computers with play-money chips and rising blinds. Chips have no real value.',
    category: 'Strategy',
    accent: 'from-slate-700 to-emerald-600',
    glyph: '♣️',
    estimated: '10–25 min',
  },
  Component: lazy(() => import('../Poker').then((m) => ({ default: m.Poker }))),
} satisfies CatalogEntry
