import { chooseAction } from './bot'
import { applyAction, newGame, type Action } from './rules'

/** Test helper: finds a seed whose all-bot 2-player match is won by seat 0 and returns every action but the winning move. */
export function nearlyWon(prefix: string): { seed: string; actions: Action[] } {
  for (let n = 0; n < 500; n++) {
    const seed = `${prefix}${n}`
    let s = newGame(2, seed)
    const actions: Action[] = []
    while (s.phase !== 'done' && actions.length < 3000) {
      const a = chooseAction(s)
      actions.push(a)
      s = applyAction(s, a)
    }
    if (s.phase === 'done' && s.winner === 0 && actions[actions.length - 1].type === 'move') return { seed, actions: actions.slice(0, -1) }
  }
  throw new Error('no seed found')
}
