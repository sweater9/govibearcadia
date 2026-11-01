import type { Seat } from './rules'

/** Players are told apart by name and shape as well as colour. */
export const SEAT_INFO: readonly { name: string; side: string; glyph: string; color: string }[] = [
  { name: 'Violet', side: 'top', glyph: '●', color: '#a78bfa' },
  { name: 'Cyan', side: 'left', glyph: '■', color: '#22d3ee' },
  { name: 'Amber', side: 'bottom', glyph: '▲', color: '#fbbf24' },
  { name: 'Rose', side: 'right', glyph: '◆', color: '#fb7185' },
]

/** Which seats people sit in; the computer plays the rest. Two players sit opposite each other. */
export const HUMAN_SEATS: Record<number, readonly Seat[]> = { 1: [0], 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] }
