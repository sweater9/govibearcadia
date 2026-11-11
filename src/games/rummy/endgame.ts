import { chooseAction } from './bot'
import { applyAction, newGame, type Action } from './rules'

/** Test helper: a seed whose computer-only 2-player game is won by seat 0 declaring; returns every action up to the declaration, and the declaration itself. */
export function nearlyDeclared(prefix: string): { seed: string; actions: Action[]; declare: Extract<Action, { type: 'declare' }> } {
  for (let n = 0; n < 300; n++) {
    const seed = `${prefix}${n}`
    let s = newGame(2, seed)
    const actions: Action[] = []
    while (s.phase !== 'done' && actions.length < 600) {
      const a = chooseAction(s)
      actions.push(a)
      s = applyAction(s, a)
    }
    const last = actions[actions.length - 1]
    if (s.phase === 'done' && s.winner === 0 && last.type === 'declare' && actions.length > 3) return { seed, actions: actions.slice(0, -1), declare: last }
  }
  throw new Error('no seed found')
}
