import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 120,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.brk-field',
  meta: {
    id: 'brick-breaker',
    title: 'Brick Breaker',
    description: 'Steer the ball, smash the wall, keep it in play.',
    category: 'Arcade',
    accent: 'from-orange-500 to-pink-500',
    glyph: '▤',
    estimated: '3–6 min',
  },
  Component: lazy(() => import('../BrickBreaker').then((m) => ({ default: m.BrickBreaker }))),
} satisfies CatalogEntry
