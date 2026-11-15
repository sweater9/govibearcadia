import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 330,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.kl-board',
  meta: {
    id: 'klondike',
    title: 'Klondike Solitaire',
    description: 'The classic patience game: build four suit piles from ace to king. Draw one or three, with undo and auto-finish.',
    category: 'Cards',
    accent: 'from-emerald-700 to-teal-500',
    glyph: '♠',
    estimated: '5–15 min',
  },
  Component: lazy(() => import('../Klondike').then((m) => ({ default: m.Klondike }))),
} satisfies CatalogEntry
