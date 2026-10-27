import { registry } from '../games/registry'

/** Catalogue metadata derived from the registry. Do not add games here; add them to the registry. */
export const games = registry.map((entry) => entry.meta)

export const categories = ['All', ...new Set(games.map((game) => game.category))]
