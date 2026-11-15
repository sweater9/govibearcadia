import { NAMES } from './rules'

export type Labels = 'kanji' | 'english' | 'both'
const FULL: Record<number, string> = { 9: 'tokin', 10: 'promoted lance', 11: 'promoted knight', 12: 'promoted silver', 14: 'horse (promoted bishop)', 15: 'dragon (promoted rook)' }
export const pieceName = (kind: number) => FULL[kind] ?? NAMES[kind]

/** Square names as shogi players write them: file 9 to 1 from the left, rank a to i from the top. */
export const squareName = (i: number) => `${9 - (i % 9)}${'abcdefghi'[(i / 9) | 0]}`
