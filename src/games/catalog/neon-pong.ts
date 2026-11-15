import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 130,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.pong-field',
  meta: {
    id: 'neon-pong',
    title: 'Neon Pong',
    description: 'Rally against the machine. First to seven wins.',
    category: 'Arcade',
    accent: 'from-cyan-400 to-violet-600',
    glyph: '◐',
    estimated: '2–5 min',
  },
  Component: lazy(() => import('../NeonPong').then((m) => ({ default: m.NeonPong }))),
} satisfies CatalogEntry
