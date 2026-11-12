import { chooseAction } from './bot'
import { matchResult, newPool, settle, startDeal } from './pool'
import { applyAction, type Action } from './rules'

/**
 * Test helper: a seed whose computer-only 2-player pool (limit 100) is won by seat 0 declaring in the last deal.
 * Returns every deal before it, the last deal's actions up to the declaration, and the declaration itself.
 */
export function nearlyWon(prefix: string): { seed: string; limit: number; past: Action[][]; actions: Action[]; declare: Extract<Action, { type: 'declare' }> } {
  const limit = 100
  for (let n = 0; n < 400; n++) {
    const seed = `${prefix}${n}`
    let pool = newPool(2, limit)
    const past: Action[][] = []
    for (let deal = 0; deal < 12; deal++) {
      const dealt = startDeal(pool, seed)
      let state = dealt.state
      const seats = dealt.seats
      const actions: Action[] = []
      while (state.phase !== 'done' && actions.length < 600) {
        const a = chooseAction(state)
        actions.push(a)
        state = applyAction(state, a)
      }
      if (state.phase !== 'done') break
      pool = settle(pool, seats, state)
      const result = matchResult(pool)
      const last = actions[actions.length - 1]
      if (result.over) {
        if (result.winner === 0 && state.winner === 0 && last.type === 'declare' && actions.length > 3 && past.length >= 1) return { seed, limit, past, actions: actions.slice(0, -1), declare: last }
        break
      }
      past.push(actions)
    }
  }
  throw new Error('no seed found')
}
