import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 250,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.gb-board',
  meta: {
    id: 'ghata-bara',
    title: 'Ghata Bara',
    description: 'The traditional four-player race: long dice, Chowka and Baara, paired Jugas, pins and captures.',
    category: 'Strategy',
    accent: 'from-fuchsia-500 to-amber-500',
    glyph: '❖',
    estimated: '30–60 min',
  },
  Component: lazy(() => import('../GhataBara').then((m) => ({ default: m.GhataBara }))),
} satisfies CatalogEntry
