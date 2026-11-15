import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 30,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.pulse-field',
  meta: {
    id: 'pulse-tap',
    title: 'Pulse Tap',
    description: 'Thirty seconds. One moving target. Stay sharp.',
    category: 'Arcade',
    accent: 'from-rose-500 to-orange-400',
    glyph: '◎',
    estimated: '30 sec',
  },
  Component: lazy(() => import('../PulseTap').then((m) => ({ default: m.PulseTap }))),
} satisfies CatalogEntry
