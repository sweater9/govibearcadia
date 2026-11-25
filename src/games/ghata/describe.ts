import type { GameEvent, Seat } from './rules'
import { SEAT_INFO } from './seats'

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function describe(events: GameEvent[]): string {
  const name = (s: Seat) => SEAT_INFO[s].name
  const parts = events.map((e) => {
    switch (e.type) {
      case 'roll': return `${name(e.seat)} rolled ${e.total === 6 ? 'Chowka (6)' : e.total === 12 ? 'Baara (12)' : e.total}`
      case 'bonus-roll': return 'roll again'
      case 'bust': return `three in a row: ${name(e.seat)} busts and the sequence is lost`
      case 'release': return `${name(e.seat)} released a pawn`
      case 'capture': return `${name(e.seat)} captured ${plural(e.pawns, 'pawn')}`
      case 'pin': return `${name(e.seat)} pinned a pawn`
      case 'rescue': return 'the pinned pawn is free'
      case 'juga': return `${name(e.seat)} formed a Juga`
      case 'home': return `${plural(e.pawns, 'pawn')} home for ${name(e.seat)}`
      case 'forfeit': return `no legal use for ${e.chunks.join(', ')}`
      case 'capture-bonus': return `${name(e.seat)} earned a capture bonus roll`
      case 'win': return `${name(e.seat)} wins`
    }
  })
  return parts.length ? `${parts.join('; ')}.` : ''
}
