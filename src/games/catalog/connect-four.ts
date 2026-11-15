import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 70,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.c4-board',
  meta: {
    id: 'connect-four',
    title: 'Connect Four',
    description: 'Drop discs and line up four before the computer does.',
    category: 'Strategy',
    accent: 'from-red-500 to-yellow-400',
    glyph: '◍',
    estimated: '3–8 min',
  },
  Component: lazy(() => import('../ConnectFour').then((m) => ({ default: m.ConnectFour }))),
} satisfies CatalogEntry
