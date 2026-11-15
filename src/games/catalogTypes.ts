import type { ComponentType } from 'react'
import type { GameMeta, GameProps } from '../types'

/**
 * One file per game in `src/games/catalog/`. The registry collects them all, so adding a game never edits a shared list.
 * `order` sets where the game appears (ascending); give a new game the next multiple of ten.
 */
export type CatalogEntry = {
  order: number
  /** CSS selector of the element a player looks at and interacts with. The layout e2e checks it is fully on screen. */
  playArea: string
  meta: GameMeta
  Component: ComponentType<GameProps>
}
