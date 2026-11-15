import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 80,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.ttt-board',
  meta: {
    id: 'tic-tac-toe',
    title: 'Tic-Tac-Toe',
    description: 'Three in a row. Outsmart the computer, or play a friend online.',
    category: 'Strategy',
    accent: 'from-cyan-400 to-violet-500',
    glyph: '✕',
    estimated: '1–2 min',
  },
  Component: lazy(() => import('../TicTacToe').then((m) => ({ default: m.TicTacToe }))),
} satisfies CatalogEntry
