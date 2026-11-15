import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 190,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.sdk',
  meta: {
    id: 'sudoku-master',
    title: 'Sudoku Master',
    description: 'Fill the grid so every row, column and box holds 1 to 9.',
    category: 'Logic',
    accent: 'from-indigo-500 to-cyan-400',
    glyph: '▦',
    estimated: '5–20 min',
    daily: true,
    challenge: true,
  },
  Component: lazy(() => import('../SudokuMaster').then((m) => ({ default: m.SudokuMaster }))),
} satisfies CatalogEntry
