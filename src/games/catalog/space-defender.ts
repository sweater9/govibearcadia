import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 200,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.sd-field',
  meta: {
    id: 'space-defender',
    title: 'Space Defender',
    description: 'Hold the line against five waves of descending invaders.',
    category: 'Arcade',
    accent: 'from-fuchsia-500 to-indigo-600',
    glyph: '▲',
    estimated: '4–8 min',
  },
  Component: lazy(() => import('../SpaceDefender').then((m) => ({ default: m.SpaceDefender }))),
} satisfies CatalogEntry
