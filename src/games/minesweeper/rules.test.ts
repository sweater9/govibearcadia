import { describe, expect, it } from 'vitest'
import { createRandom } from '../../lib/rng'
import {
  BEGINNER,
  chord,
  minesLeft,
  neighbors,
  newGame,
  reveal,
  safeCellCount,
  scoreFor,
  toggleFlag,
  type Config,
  type MinesState,
} from './rules'

const mineCount = (state: MinesState) => state.cells.flat().filter((cell) => cell.mine).length
const coords = (state: MinesState) =>
  state.cells.flatMap((row, r) => row.map((cell, c) => ({ r, c, cell })))
const hiddenSafe = (state: MinesState) => coords(state).filter((x) => !x.cell.mine && x.cell.state === 'hidden')

/** A started game with a fixed layout, so rules can be checked without depending on the RNG. */
function fixed(layout: string[], config?: Config): MinesState {
  const rows = layout.length
  const cols = layout[0].length
  const cfg = config ?? { rows, cols, mines: layout.join('').split('*').length - 1 }
  const state = newGame(cfg)
  const cells = state.cells.map((row, r) =>
    row.map((_, c) => ({ mine: layout[r][c] === '*', adjacent: 0, state: 'hidden' as const })),
  )
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells[r][c].adjacent = neighbors(cfg, r, c).filter(([nr, nc]) => cells[nr][nc].mine).length
    }
  }
  return { ...state, cells, status: 'playing' }
}

describe('new game', () => {
  it('is a blank, unstarted beginner board', () => {
    const state = newGame()
    expect(state.config).toEqual(BEGINNER)
    expect(state.status).toBe('ready')
    expect(state.cells).toHaveLength(9)
    expect(state.cells.flat()).toHaveLength(81)
    expect(mineCount(state)).toBe(0)
  })
})

describe('first reveal', () => {
  it('places exactly the configured number of mines', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      expect(mineCount(reveal(newGame(), 4, 4, createRandom(seed)))).toBe(BEGINNER.mines)
    }
  })

  it('never loses on the first click, and clears the clicked cell and its neighbours of mines', () => {
    for (let i = 0; i < 200; i++) {
      const r = i % 9
      const c = Math.floor(i / 9) % 9
      const state = reveal(newGame(), r, c, createRandom(`seed-${i}`))
      expect(state.status, `seed-${i} at ${r},${c}`).not.toBe('lost')
      for (const [nr, nc] of [[r, c], ...neighbors(BEGINNER, r, c)]) expect(state.cells[nr][nc].mine).toBe(false)
    }
  })

  it('opens a cascade because the first cell has no adjacent mines', () => {
    const state = reveal(newGame(), 4, 4, createRandom('cascade'))
    expect(state.cells[4][4].adjacent).toBe(0)
    expect(state.opened).toBeGreaterThan(1)
  })

  it('is deterministic for a given seed', () => {
    const a = reveal(newGame(), 2, 6, createRandom('daily'))
    const b = reveal(newGame(), 2, 6, createRandom('daily'))
    expect(a).toEqual(b)
    expect(reveal(newGame(), 2, 6, createRandom('other'))).not.toEqual(a)
  })

  it('still works on a board too crowded to keep the neighbours clear', () => {
    const config: Config = { rows: 3, cols: 3, mines: 8 }
    const state = reveal(newGame(config), 1, 1, createRandom('crowded'))
    expect(mineCount(state)).toBe(8)
    expect(state.cells[1][1].mine).toBe(false)
  })

  it('computes adjacent mine counts correctly', () => {
    const state = reveal(newGame(), 4, 4, createRandom('counts'))
    for (const { r, c, cell } of coords(state)) {
      const expected = neighbors(BEGINNER, r, c).filter(([nr, nc]) => state.cells[nr][nc].mine).length
      expect(cell.adjacent).toBe(expected)
    }
  })
})

describe('reveal', () => {
  it('opens one numbered cell without cascading', () => {
    const state = fixed(['*..', '...', '...'])
    const next = reveal(state, 0, 1)
    expect(next.cells[0][1].state).toBe('open')
    expect(next.opened).toBe(1)
  })

  it('floods through zero cells and stops at numbers, leaving cells behind a wall of mines hidden', () => {
    const state = fixed(['..*..', '..*..', '..*..'])
    const next = reveal(state, 0, 0)
    expect(next.opened).toBe(6) // columns 0 and 1 only
    expect(next.cells[0][1]).toMatchObject({ state: 'open', adjacent: 2 }) // a number: opened, but does not spread
    expect(next.cells[0][3].state).toBe('hidden')
    expect(next.cells[0][4].state).toBe('hidden')
    expect(next.status).toBe('playing')
  })

  it('wins on the spot when one cascade clears the whole board, marking the mine', () => {
    const next = reveal(fixed(['....', '....', '....', '...*']), 0, 0)
    expect(next.opened).toBe(15)
    expect(next.status).toBe('won')
    expect(next.cells[3][3].state).toBe('flagged')
  })

  it('loses when a mine is opened, and reveals the other mines', () => {
    const state = fixed(['*.*', '...', '...'])
    const next = reveal(state, 0, 0)
    expect(next.status).toBe('lost')
    expect(next.exploded).toEqual([0, 0])
    expect(next.cells[0][2].state).toBe('open')
  })

  it('does not open flagged cells', () => {
    const state = toggleFlag(fixed(['*..', '...', '...']), 1, 1)
    expect(reveal(state, 1, 1)).toBe(state)
  })

  it('ignores already-open cells', () => {
    const once = reveal(fixed(['*..', '...', '...']), 0, 1)
    expect(reveal(once, 0, 1)).toBe(once)
  })

  it('ignores every move after the game ends', () => {
    const lost = reveal(fixed(['*..', '...', '...']), 0, 0)
    expect(reveal(lost, 2, 2)).toBe(lost)
    expect(toggleFlag(lost, 2, 2)).toBe(lost)
  })

  it('does not mutate the previous state', () => {
    const state = fixed(['*..', '...', '...'])
    const snapshot = JSON.stringify(state)
    reveal(state, 2, 2)
    expect(JSON.stringify(state)).toBe(snapshot)
  })

  it('wins exactly when every safe cell is open', () => {
    let state = reveal(newGame(), 4, 4, createRandom('win'))
    for (const { r, c } of hiddenSafe(state)) {
      expect(state.status).toBe('playing')
      state = reveal(state, r, c)
    }
    expect(state.status).toBe('won')
    expect(state.opened).toBe(safeCellCount(BEGINNER))
    expect(coords(state).filter((x) => x.cell.mine).every((x) => x.cell.state === 'flagged')).toBe(true)
    expect(minesLeft(state)).toBe(0)
  })
})

describe('flags', () => {
  it('toggles on and off and tracks mines left', () => {
    const state = fixed(['*..', '...', '...'])
    const flagged = toggleFlag(state, 2, 2)
    expect(flagged.cells[2][2].state).toBe('flagged')
    expect(minesLeft(flagged)).toBe(0)
    const cleared = toggleFlag(flagged, 2, 2)
    expect(cleared.cells[2][2].state).toBe('hidden')
    expect(minesLeft(cleared)).toBe(1)
  })

  it('cannot flag an open cell', () => {
    const opened = reveal(fixed(['*..', '...', '...']), 0, 1)
    expect(toggleFlag(opened, 0, 1)).toBe(opened)
  })

  it('may be placed before the first reveal', () => {
    const flagged = toggleFlag(newGame(), 0, 0)
    expect(flagged.status).toBe('ready')
    expect(minesLeft(flagged)).toBe(BEGINNER.mines - 1)
  })
})

describe('chord', () => {
  const layout = ['*..', '.1.', '...']

  it('opens the remaining neighbours when the flag count matches the number', () => {
    let state = fixed(['*...', '....', '....', '....'])
    state = reveal(state, 1, 1) // a "1" next to the mine
    state = toggleFlag(state, 0, 0)
    const next = chord(state, 1, 1)
    expect(next.opened).toBeGreaterThan(state.opened)
    expect(next.cells[1][2].state).toBe('open')
    expect(next.status).not.toBe('lost')
  })

  it('does nothing when the flag count does not match', () => {
    const state = reveal(fixed(['*...', '....', '....', '....']), 1, 1)
    expect(chord(state, 1, 1)).toBe(state)
  })

  it('loses if a flag was wrong', () => {
    let state = reveal(fixed(['*...', '....', '....', '....']), 1, 1)
    state = toggleFlag(state, 1, 0) // wrong cell; the mine is at 0,0
    expect(chord(state, 1, 1).status).toBe('lost')
  })

  it('ignores hidden cells and zero cells', () => {
    const state = fixed(layout)
    expect(chord(state, 2, 2)).toBe(state)
    const opened = reveal(fixed(['....', '....', '....', '...*']), 0, 0)
    expect(chord(opened, 0, 0)).toBe(opened)
  })
})

describe('scoring', () => {
  it('gives partial credit for a lost game', () => {
    let state = reveal(fixed(['..*..', '..*..', '..*..']), 0, 0) // opens 6 safe cells, game continues
    expect(state.status).toBe('playing')
    state = reveal(state, 1, 2) // a mine
    expect(state.status).toBe('lost')
    expect(scoreFor(state, 12)).toBe(60)
  })

  it('rewards a faster win and floors the time bonus', () => {
    let state = reveal(newGame(), 4, 4, createRandom('score'))
    for (const { r, c } of hiddenSafe(state)) state = reveal(state, r, c)
    expect(state.status).toBe('won')
    expect(scoreFor(state, 30)).toBeGreaterThan(scoreFor(state, 120))
    expect(scoreFor(state, 600)).toBe(safeCellCount(BEGINNER) * 10 + 200)
  })
})
