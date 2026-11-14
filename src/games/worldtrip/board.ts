/** The World Trip track: 40 spaces, clockwise from the bottom-right corner. Index 0 is space 1 (Departure Gate). */

export type Landmark =
  | 'bridge' | 'tower' | 'skyline' | 'mountains' | 'waterfront' | 'columns' | 'dome' | 'pagoda' | 'sails' | 'pyramid' | 'palm' | 'canal' | 'windmill' | 'castle' | 'tram' | 'arch'

export type CitySpace = { kind: 'city'; name: string; country: string; group: number; price: number; fee: number; landmark: Landmark }
export type AssetSpace = { kind: 'airport' | 'service'; name: string; price: number; fee: number }
export type OtherSpace = { kind: 'corner'; name: string } | { kind: 'card'; name: string; deck: 'travel' | 'fortune' } | { kind: 'fee'; name: string; amount: number }
export type Space = CitySpace | AssetSpace | OtherSpace

export const BOARD_SIZE = 40
export const GRID = 11

const city = (name: string, country: string, group: number, price: number, landmark: Landmark): Space => ({ kind: 'city', name, country, group, price, fee: Math.round(price / 10), landmark })
const airport = (name: string): Space => ({ kind: 'airport', name, price: 200, fee: 50 })
const service = (name: string): Space => ({ kind: 'service', name, price: 150, fee: 35 })
const travel: Space = { kind: 'card', name: 'Travel Card', deck: 'travel' }
const fortune: Space = { kind: 'card', name: 'Fortune Card', deck: 'fortune' }

export const BOARD: readonly Space[] = [
  // Bottom edge, right to left: spaces 1-10
  { kind: 'corner', name: 'Departure Gate' }, city('Vancouver', 'Canada', 0, 60, 'mountains'), travel, city('Toronto', 'Canada', 0, 80, 'tower'),
  { kind: 'fee', name: 'Ticket Fee', amount: 100 }, airport('Pacific Airport'), city('Mexico City', 'Mexico', 1, 100, 'pyramid'), fortune,
  city('New York', 'United States', 1, 120, 'skyline'), city('San Francisco', 'United States', 1, 140, 'bridge'),
  // Left edge, bottom to top: spaces 11-20
  { kind: 'corner', name: 'Hotel Stopover' }, city('Lisbon', 'Portugal', 2, 160, 'tram'), service('Rail Pass'), city('Barcelona', 'Spain', 2, 180, 'dome'),
  city('Rome', 'Italy', 2, 200, 'columns'), airport('Atlantic Airport'), city('Amsterdam', 'Netherlands', 3, 220, 'canal'), travel,
  city('Paris', 'France', 3, 240, 'tower'), city('London', 'United Kingdom', 3, 260, 'bridge'),
  // Top edge, left to right: spaces 21-30
  { kind: 'corner', name: 'World Festival' }, city('Stockholm', 'Sweden', 4, 280, 'castle'), fortune, city('Copenhagen', 'Denmark', 4, 300, 'waterfront'),
  city('Oslo', 'Norway', 4, 320, 'sails'), airport('Europe Airport'), city('Cape Town', 'South Africa', 5, 340, 'mountains'),
  city('Nairobi', 'Kenya', 5, 360, 'palm'), service('Ferry Pass'), city('Dubai', 'United Arab Emirates', 5, 380, 'tower'),
  // Right edge, top to bottom: spaces 31-40
  { kind: 'corner', name: 'Scenic Stopover' }, city('Mumbai', 'India', 6, 400, 'arch'), city('Singapore', 'Singapore', 6, 420, 'skyline'), travel,
  city('Bangkok', 'Thailand', 7, 440, 'pagoda'), airport('Global Airport'), fortune, city('Tokyo', 'Japan', 7, 460, 'pagoda'),
  { kind: 'fee', name: 'Luggage Fee', amount: 80 }, city('Sydney', 'Australia', 7, 500, 'sails'),
]

/** Cities by colour group, in board order. Groups are 2 or 3 cities along one edge. */
export const GROUPS: readonly (readonly number[])[] = (() => {
  const out: number[][] = []
  BOARD.forEach((space, i) => { if (space.kind === 'city') (out[space.group] ??= []).push(i) })
  return out
})()
export const GROUP_COLOURS = ['#c2410c', '#b45309', '#4d7c0f', '#0f766e', '#1d4ed8', '#6d28d9', '#be185d', '#475569'] as const
/** Where a player stranded at the Hotel Stopover waits, and what a stopover costs to leave early. */
export const HOTEL = 10
export const SCENIC = 30

/** What a visitor centre costs, by group (printed value counts towards net worth). */
export const CENTRE_COST = [50, 50, 100, 100, 150, 150, 200, 200] as const

export const isClaimable = (s: Space): s is CitySpace | AssetSpace => s.kind === 'city' || s.kind === 'airport' || s.kind === 'service'

/** Grid cell (row, column; both 0-10) of each track index, drawn clockwise from the bottom-right corner. */
export const CELLS: readonly (readonly [number, number])[] = (() => {
  const last = GRID - 1
  const out: [number, number][] = []
  for (let i = 0; i < 10; i++) out.push([last, last - i]) // bottom edge, right to left
  for (let i = 0; i < 10; i++) out.push([last - i, 0]) // left edge, bottom to top
  for (let i = 0; i < 10; i++) out.push([0, i]) // top edge, left to right
  for (let i = 0; i < 10; i++) out.push([i, last]) // right edge, top to bottom
  return out
})()
