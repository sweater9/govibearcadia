import type { ComponentType } from 'react'
import type { GameMeta, GameProps } from '../types'
import type { CatalogEntry } from './catalogTypes'

export type GameEntry = { meta: GameMeta; Component: ComponentType<GameProps> }

/**
 * Single source of truth for games, collected from `src/games/catalog/<id>.ts` (one file per game).
 * To add one: create the component, then add one catalog file. Components are lazy-loaded inside each catalog file,
 * so every game is its own chunk and loads on demand. Games appear in ascending `order`.
 */
const modules = import.meta.glob<{ default: CatalogEntry }>('./catalog/*.ts', { eager: true })

export const registry: GameEntry[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.order - b.order)
  .map(({ meta, Component }) => ({ meta, Component }))

export const getGame = (id?: string): GameEntry | undefined => registry.find((entry) => entry.meta.id === id)
