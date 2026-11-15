import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 20,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.memory-grid',
  meta: {
    id: 'memory-grid',
    title: 'Memory Grid',
    description: 'Match every signal in the fewest possible moves.',
    category: 'Focus',
    accent: 'from-cyan-400 to-blue-600',
    glyph: '✦',
    estimated: '2–4 min',
    daily: true,
    challenge: true,
  },
  Component: lazy(() => import('../MemoryGrid').then((m) => ({ default: m.MemoryGrid }))),
} satisfies CatalogEntry
