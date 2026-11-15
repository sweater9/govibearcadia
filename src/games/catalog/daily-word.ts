import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 110,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.wordle',
  meta: {
    id: 'daily-word',
    title: 'Daily Word',
    description: 'Six guesses to find the word of the day. Same word for everyone.',
    category: 'Word',
    accent: 'from-emerald-400 to-lime-500',
    glyph: 'Ⓦ',
    estimated: '2–5 min',
    daily: true,
  },
  Component: lazy(() => import('../DailyWord').then((m) => ({ default: m.DailyWord }))),
} satisfies CatalogEntry
