/** Board geometry for Ludo: a 15 x 15 grid with a 52-square ring. Pure data, shared by the rules, the computer player and the screen. */
export const GRID = 15
export const RING_SIZE = 52
export const TOKENS_EACH = 4
export const FINISHED = 56
/** Progress values: -1 in the yard, 0 to 50 on the ring (0 is the start square), 51 to 55 in the home column, 56 finished. */
export const LAST_RING_STEP = 50

type Cell = readonly [row: number, col: number]

/** The ring, clockwise, starting at the top-left player's start square. */
const BASE: Cell[] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
]

/** Ring index 0 is seat 0's start square (bottom left); seats run clockwise from there. */
export const RING: readonly Cell[] = Array.from({ length: RING_SIZE }, (_, i) => BASE[(i + 39) % RING_SIZE])

export const HOME_COLUMN: readonly (readonly Cell[])[] = [
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
]

export const YARD: readonly (readonly Cell[])[] = [
  [[10, 1], [10, 4], [13, 1], [13, 4]],
  [[1, 1], [1, 4], [4, 1], [4, 4]],
  [[1, 10], [1, 13], [4, 10], [4, 13]],
  [[10, 10], [10, 13], [13, 10], [13, 13]],
]

/** Each seat's start square is 13 squares round the ring from the previous seat's. */
export const startIndex = (seat: number) => 13 * seat
export const ringIndex = (seat: number, progress: number) => (startIndex(seat) + progress) % RING_SIZE
/** Start squares and the star squares eight along from them are safe: no capture there. */
export const isSafeRing = (index: number) => index % 13 === 0 || index % 13 === 8

/** Where a token is drawn, as fractional grid coordinates. */
export function cellOf(seat: number, token: number, progress: number): readonly [number, number] {
  if (progress < 0) return YARD[seat][token]
  if (progress <= LAST_RING_STEP) return RING[ringIndex(seat, progress)]
  if (progress < FINISHED) return HOME_COLUMN[seat][progress - 51]
  const spread = (token - 1.5) * 0.28
  return [
    [7 + 0.42, 7 + spread],
    [7 + spread, 7 - 0.42],
    [7 - 0.42, 7 + spread],
    [7 + spread, 7 + 0.42],
  ][seat] as [number, number]
}
