import { activePlayer, money, standings, type State } from './rules'

/** The line under the board: whose turn, what was rolled and what happened, or who won. */
export const statusFor = (state: State, name: (i: number) => string, relabel: (text: string) => string) => {
  const ranking = standings(state)
  const leaders = ranking.filter((e) => e.worth === ranking[0].worth)
  const current = activePlayer(state)
  return state.phase === 'done'
    ? `${leaders.map(({ index }) => name(index)).join(' and ')} ${leaders.length > 1 ? 'share the win' : 'wins'} with ${money(leaders[0].worth)}.`
    : `Round ${Math.floor(state.turn / state.players.length) + 1} of ${state.turnsEach} · ${name(current)}. ${state.dice ? `Rolled ${state.dice.join(' + ')}. ` : ''}${relabel(state.message)}`
}
