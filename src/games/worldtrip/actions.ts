import { BOARD } from './board'
import type { Action } from './rules'

const int = (v: unknown): v is number => Number.isInteger(v)
const stops = (v: unknown): v is number[] => Array.isArray(v) && v.length <= 12 && v.every((i) => int(i) && i >= 0 && i < BOARD.length)

/** Shape check for an action that came from storage or the network. The rules still decide whether it is legal. */
export function isAction(value: unknown): value is Action {
  if (!value || typeof value !== 'object') return false
  const a = value as Action
  switch (a.type) {
    case 'roll': case 'buy': case 'skip': case 'accept': case 'decline': case 'end': case 'drop': case 'payout': case 'usepass': return true
    case 'bid': return Number.isSafeInteger(a.amount)
    case 'upgrade': case 'mortgage': case 'redeem': return int(a.space) && a.space >= 0 && a.space < BOARD.length
    case 'offer': return !!a.offer && int(a.offer.buyer) && Number.isSafeInteger(a.offer.cash) && stops(a.offer.give) && stops(a.offer.take)
    default: return false
  }
}
