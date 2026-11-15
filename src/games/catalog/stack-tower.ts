import { lazy } from 'react'
import type { CatalogEntry } from '../catalogTypes'

export default {
  order: 160,
  /** The element a player looks at and interacts with; the layout e2e checks it fits on screen. */
  playArea: '.stk-drop',
  meta: {
    id: 'stack-tower',
    title: 'Stack Tower',
    description: 'Time each drop to stack the blocks as high as you can. Miss the line and the overhang is cut off.',
    category: 'Arcade',
    accent: 'from-cyan-400 to-violet-500',
    glyph: '▤',
    estimated: '1–4 min',
  },
  Component: lazy(() => import('../StackTower').then((m) => ({ default: m.StackTower }))),
} satisfies CatalogEntry
