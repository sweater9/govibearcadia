import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 340,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.cb-hand',
  meta: {
    id: 'call-break',
    title: 'Call Break',
    description: 'The trick-taking classic from Nepal and India: bid your tricks, spades are always trump, five rounds against three computers.',
    category: 'Cards',
    accent: 'from-slate-600 to-sky-500',
    glyph: '♠',
    estimated: '15–25 min',
  },
  Component: lazy(() => import('../CallBreak').then((m) => ({ default: m.CallBreak }))),
} satisfies CatalogEntry
