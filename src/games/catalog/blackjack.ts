import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 360,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.bj-table',
  meta: {
    id: 'blackjack',
    title: 'Blackjack',
    description: 'Beat the dealer to 21 with play-money chips: hit, stand, double down and split. Chips have no real value.',
    category: 'Strategy',
    accent: 'from-emerald-700 to-teal-500',
    glyph: '♠️',
    estimated: '5–15 min',
  },
  Component: lazy(() => import('../Blackjack').then((m) => ({ default: m.Blackjack }))),
} satisfies CatalogEntry
