import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 140,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.ng-board',
  meta: {
    id: 'nonogram',
    title: 'Nonogram',
    description: 'Picture puzzles: the numbers give the runs of filled squares in each row and column. Reveal the hidden picture.',
    category: 'Logic',
    accent: 'from-sky-400 to-indigo-600',
    glyph: '▩',
    estimated: '3–15 min',
  },
  Component: lazy(() => import('../Nonogram').then((m) => ({ default: m.Nonogram }))),
} satisfies CatalogEntry
