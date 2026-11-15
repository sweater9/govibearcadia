import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 170,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.hp-pad',
  meta: {
    id: 'lane-hopper',
    title: 'Lane Hopper',
    description: 'Hop across endless roads, dodge the traffic and keep moving before the eagle spots you.',
    category: 'Arcade',
    accent: 'from-emerald-400 to-sky-500',
    glyph: '🐸',
    estimated: '1–5 min',
  },
  Component: lazy(() => import('../LaneHopper').then((m) => ({ default: m.LaneHopper }))),
} satisfies CatalogEntry
