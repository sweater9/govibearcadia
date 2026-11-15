import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import { LEVELS, chooseMove } from './ai'
import { fromFen, newGame } from './rules'

/**
 * The computer's choices, recorded before its search moved into the shared `lib/search.ts`: from-to squares (promotion suffix)
 * at easy, normal and hard. The refactor must not change how it plays.
 */
const GOLDEN: Record<string, string[]> = {
  "start": ["55-47", "54-38", "55-39"],
  "6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1": ["56-0", "56-0", "56-0"],
  "4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1": ["59-27", "59-27", "59-27"],
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3": ["45-28", "54-38", "51-35"],
  "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1": ["45-21", "52-16", "52-16"],
  "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1": ["33-37", "33-37", "33-37"],
  "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8": ["11-2q", "11-2q", "11-2q"],
}

describe('chess computer plays exactly as before the shared search', () => {
  for (const [fen, expected] of Object.entries(GOLDEN)) {
    it(fen === 'start' ? 'the starting position' : fen, () => {
      const s = fen === 'start' ? newGame() : fromFen(fen)
      const got = LEVELS.map((lv) => {
        const m = chooseMove(s, lv, createRandom(`g:${fen}:${lv}`))
        return m ? `${m.from}-${m.to}${m.promo ?? ''}` : 'none'
      })
      expect(got).toEqual(expected)
    }, 60_000)
  }
})
