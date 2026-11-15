import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 10,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.merge-board',
  meta: {
    id: 'neon-merge',
    title: 'Neon Merge',
    description: 'Slide luminous tiles and chase the 2048 core.',
    category: 'Puzzle',
    accent: 'from-violet-500 to-fuchsia-500',
    glyph: '◇',
    estimated: '3–8 min',
  },
  Component: lazy(() => import('../NeonMerge').then((m) => ({ default: m.NeonMerge }))),
} satisfies CatalogEntry
