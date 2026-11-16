import { CELL, centre, holeSide, pathBetween, type Cell, type MState, type Tilt } from './rules'

/**
 * A simple autopilot used by the tests (unit and end-to-end) to prove a maze can really be rolled through. It aims
 * for the middle of the next cell, keeping to one side on cells that hold a hole, and brakes before it overshoots.
 * It only reads the state, and its output is the four arrow keys.
 */
export type Keys = { up: boolean; down: boolean; left: boolean; right: boolean }

const cellOf = (x: number, y: number): Cell => ({ c: Math.floor(x / CELL), r: Math.floor(y / CELL) })

export function autopilot(s: MState): Keys {
  const here = cellOf(s.x, s.y)
  const route = pathBetween(s, here, s.goal) ?? [here]
  const nextCell = route[1] ?? route[0]
  const { x: tx, y: ty } = centre(nextCell)
  // Run along a wall through a hole on the route: press towards it while in the cell before and in the hole's cell.
  const hole = (k: Cell) => s.holes.some((h) => h.c === k.c && h.r === k.r)
  let press: number | null = null
  for (const k of [here, nextCell]) if (hole(k)) press = holeSide(s, s.path.findIndex((p) => p.c === k.c && p.r === k.r))
  if (press === null && hole(nextCell)) press = holeSide(s, s.path.findIndex((p) => p.c === nextCell.c && p.r === nextCell.r))
  // Aim a little past the middle of the next cell on straight runs so the marble keeps moving.
  const wish = (e: number, v: number) => {
    const desired = Math.max(-16, Math.min(16, e * 3))
    return (desired - v) * 2
  }
  const ax = wish(tx - s.x, s.vx)
  const ay = wish(ty - s.y, s.vy)
  const thr = 6
  const keys: Keys = { left: ax < -thr, right: ax > thr, up: ay < -thr, down: ay > thr }
  if (press !== null) {
    if (press === 0 || press === 2) {
      keys.up = press === 0
      keys.down = press === 2
    } else {
      keys.left = press === 3
      keys.right = press === 1
    }
  }
  return keys
}

export const tiltFromKeys = (k: Keys): Tilt => ({ x: (k.right ? 1 : 0) - (k.left ? 1 : 0), y: (k.down ? 1 : 0) - (k.up ? 1 : 0) })
