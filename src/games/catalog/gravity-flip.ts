import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 210,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.gf',
  meta: {
    id: 'gravity-flip',
    title: 'Gravity Flip',
    description: 'Flip gravity to reach the exit in as few moves as you can. Ten handmade levels.',
    category: 'Puzzle',
    accent: 'from-cyan-400 to-violet-600',
    glyph: '⇅',
    estimated: '5–10 min',
  },
  Component: lazy(() => import('../GravityFlip').then((m) => ({ default: m.GravityFlip }))),
} satisfies CatalogEntry
