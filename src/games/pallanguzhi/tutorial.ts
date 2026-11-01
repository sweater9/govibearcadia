import { apply, newGame, seedsOnBoard, type State } from './rules'

/**
 * The guided lesson. Every step is real play on the real engine: a step either sets up a teaching position,
 * carries on from the last one, or moves to the next round. `expect` is the pit the learner must tap.
 */
export type TutorialStep = {
  id: string
  title: string
  text: string
  /** Shown after the learner's move has played out. */
  after?: string
  expect?: number
  setup?: () => State
  /** Start this step by refilling for the next round. */
  nextRound?: boolean
}

/** 70 seeds in all: the rest sit in the captured-seed stores. */
function teaching(pits: Record<number, number>, stores: [number, number]): State {
  const s = newGame()
  s.pits = Array(14).fill(0)
  for (const [i, n] of Object.entries(pits)) s.pits[Number(i)] = n
  s.stores = stores
  if (seedsOnBoard(s) + stores[0] + stores[1] !== 70) throw new Error('teaching position must hold 70 seeds')
  return s
}

export const TUTORIAL: TutorialStep[] = [
  {
    id: 'board',
    title: 'The board',
    text: 'Two rows of seven pits, each starting with five seeds: 70 in all. You own the bottom row, your opponent the top row. Seeds you capture are collected in your tray.',
    setup: () => newGame({ match: 'match' }),
  },
  {
    id: 'sow',
    title: 'Choose a pit and sow',
    text: 'Tap the glowing pit. All its seeds are lifted and dropped one by one into the next pits, always counterclockwise: along your row to the right, then back along the opponent’s row.',
    expect: 2,
    after:
      'Counterclockwise, one seed per pit. When your last seed landed in a pit that already had seeds, you lifted all of them and carried on the same way: that is relay sowing. It went on until the pit after the last seed was empty.',
  },
  {
    id: 'saada',
    title: 'Saada: the empty pit',
    text: 'A new position. Tap the glowing pit. Two seeds go into pits 2 and 3, and the next pit is empty. That empty pit is the Saada.',
    setup: () => teaching({ 0: 2, 1: 1, 2: 1, 4: 3, 6: 2, 8: 3, 9: 4, 12: 1, 13: 2 }, [25, 26]),
    expect: 0,
    after:
      'The Saada pit is skipped. You captured the pit just beyond it (3 seeds) and the pit directly opposite that one (4 seeds): 7 seeds into your tray. A pit that is empty adds nothing.',
  },
  {
    id: 'second',
    title: 'The second sowing',
    text: 'A capture earns a second sowing. Choose any of your pits with seeds: tap the glowing one.',
    expect: 2,
    after: 'Another capture, 2 seeds. A turn never has more than two sowings, and with no capture in the first sowing the turn simply passes to your opponent.',
  },
  {
    id: 'round',
    title: 'Ending a round',
    text: 'Near the end of a round. Tap the glowing pit to capture again.',
    setup: () => teaching({ 0: 1, 3: 4, 10: 2 }, [13, 50]),
    expect: 0,
    after: 'You captured 6 and earned another sowing.',
  },
  {
    id: 'round-end',
    title: 'Nothing left to play',
    text: 'Take the second sowing with the glowing pit.',
    expect: 1,
    after:
      'Your opponent has no seeds in their row, so the round is over. Any seeds still on the board go to the owner of the row they sit in. You now hold 20 seeds and your opponent 50.',
  },
  {
    id: 'refill',
    title: 'Refilling and piggy pits',
    text: 'Each player refills their pits with five seeds each from their captured seeds. 20 seeds fill four of your pits. The other three cannot be filled: they become piggy pits (marked, empty and skipped by sowing). Your opponent fills all seven and keeps the 15 left over.',
    nextRound: true,
  },
  {
    id: 'win',
    title: 'Winning',
    text: 'Rounds go on, with the starting player alternating. A pit that was piggy returns when you can afford to refill it. You lose when you cannot refill even one pit; your opponent wins. That is the whole game.',
  },
]

/** The board a step starts from, given the board the previous step ended on. */
export function stepStart(step: TutorialStep, previous: State): State {
  if (step.setup) return step.setup()
  if (step.nextRound) {
    const r = apply(previous, { type: 'next-round' })
    if (r.ok) return r.state
  }
  return previous
}
