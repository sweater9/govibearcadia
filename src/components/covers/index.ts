import { ARCADE_COVERS } from './arcade'
import { BOARD_COVERS, type Cover } from './boards'
import { CARD_COVERS } from './cards'
import { PUZZLE_COVERS } from './puzzles'

export type { Cover }
export const COVERS: Record<string, Cover> = { ...BOARD_COVERS, ...CARD_COVERS, ...PUZZLE_COVERS, ...ARCADE_COVERS }
