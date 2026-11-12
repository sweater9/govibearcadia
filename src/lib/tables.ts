/**
 * Stakes ladders for the chip games. Pure data and rules. You sit at a harder table by holding enough chips,
 * so a growing stack is always worth something: there is a next table to reach.
 */
export type BlackjackTable = { id: string; name: string; needs: number; min: number; max: number; chips: readonly number[] }
export const BLACKJACK_TABLES: readonly BlackjackTable[] = [
  { id: 'rookie', name: 'Rookie', needs: 0, min: 10, max: 100, chips: [10, 25, 50, 100] },
  { id: 'regular', name: 'Regular', needs: 500, min: 10, max: 500, chips: [10, 50, 100, 500] },
  { id: 'high', name: 'High roller', needs: 5000, min: 100, max: 2500, chips: [100, 500, 1000, 2500] },
]
export const DEFAULT_BLACKJACK_TABLE = 'regular'
export const blackjackTable = (id: string | undefined): BlackjackTable => BLACKJACK_TABLES.find((t) => t.id === id) ?? BLACKJACK_TABLES[1]

export type PokerTable = { id: string; name: string; needs: number; buyIn: number }
export const POKER_TABLES: readonly PokerTable[] = [
  { id: 'rookie', name: 'Rookie', needs: 0, buyIn: 100 },
  { id: 'regular', name: 'Regular', needs: 750, buyIn: 500 },
  { id: 'high', name: 'High roller', needs: 3000, buyIn: 2000 },
]
export const pokerTable = (id: string | undefined): PokerTable => POKER_TABLES.find((t) => t.id === id) ?? POKER_TABLES[0]

export const unlocked = (table: { needs: number }, chips: number): boolean => chips >= table.needs
/** The hardest table you can sit at with this many chips. */
export const bestTable = <T extends { needs: number }>(tables: readonly T[], chips: number): T => [...tables].reverse().find((t) => unlocked(t, chips)) ?? tables[0]
