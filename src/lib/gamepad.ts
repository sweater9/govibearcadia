/**
 * Pure gamepad logic: turns controller snapshots into actions and picks which button to focus next. No browser
 * APIs here, so it is unit-tested; `src/components/GamepadBridge.tsx` does the polling and the DOM work.
 *
 * Layout (the browsers' "standard" mapping): D-pad or left stick = direction, A = confirm, X = Enter, B = back,
 * Y or Start = pause, bumpers = previous or next control.
 */
export type Dir = 'up' | 'down' | 'left' | 'right'

export type PadAction =
  | { type: 'dir'; dir: Dir; repeat: boolean }
  | { type: 'confirm' }
  | { type: 'enter' }
  | { type: 'back' }
  | { type: 'pause' }
  | { type: 'tab'; back: boolean }

export type PadSnapshot = { buttons: readonly boolean[]; axes: readonly number[] }

export type PadState = {
  /** Buttons held at the last step, so only new presses count. */
  down: readonly boolean[]
  dir: Dir | null
  dirSince: number
  lastRepeat: number
}

export const STICK_DEADZONE = 0.5
export const REPEAT_DELAY_MS = 400
export const REPEAT_RATE_MS = 120

export const BUTTON = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, SELECT: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 } as const

export const initialPadState = (): PadState => ({ down: [], dir: null, dirSince: 0, lastRepeat: 0 })

/** The direction held right now: the D-pad wins over the stick, and the stick's stronger axis wins. */
export function heldDirection(s: PadSnapshot): Dir | null {
  const b = (i: number) => s.buttons[i] === true
  if (b(BUTTON.UP)) return 'up'
  if (b(BUTTON.DOWN)) return 'down'
  if (b(BUTTON.LEFT)) return 'left'
  if (b(BUTTON.RIGHT)) return 'right'
  const x = s.axes[0] ?? 0
  const y = s.axes[1] ?? 0
  if (Math.max(Math.abs(x), Math.abs(y)) < STICK_DEADZONE) return null
  return Math.abs(x) >= Math.abs(y) ? (x < 0 ? 'left' : 'right') : y < 0 ? 'up' : 'down'
}

const PRESSES: [number, PadAction][] = [
  [BUTTON.A, { type: 'confirm' }],
  [BUTTON.X, { type: 'enter' }],
  [BUTTON.B, { type: 'back' }],
  [BUTTON.Y, { type: 'pause' }],
  [BUTTON.START, { type: 'pause' }],
  [BUTTON.LB, { type: 'tab', back: true }],
  [BUTTON.RB, { type: 'tab', back: false }],
]

/** One poll: returns the new state and the actions to run. A held direction repeats after a delay, like a keyboard. */
export function stepPad(prev: PadState, snap: PadSnapshot, now: number): { state: PadState; actions: PadAction[] } {
  const actions: PadAction[] = []
  const down = snap.buttons.map((_, i) => snap.buttons[i] === true)
  for (const [i, action] of PRESSES) if (down[i] && !prev.down[i]) actions.push(action)

  const dir = heldDirection(snap)
  let { dirSince, lastRepeat } = prev
  if (dir !== prev.dir) {
    dirSince = now
    lastRepeat = now
    if (dir) actions.push({ type: 'dir', dir, repeat: false })
  } else if (dir && now - dirSince >= REPEAT_DELAY_MS && now - lastRepeat >= REPEAT_RATE_MS) {
    lastRepeat = now
    actions.push({ type: 'dir', dir, repeat: true })
  }
  return { state: { down, dir, dirSince, lastRepeat }, actions }
}

export type Rect = { left: number; top: number; right: number; bottom: number }

const centre = (r: Rect) => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 })

/**
 * Which candidate to focus when moving `dir` from `from`: the nearest one in that direction, where being off to the
 * side costs more than being further along, so a column of buttons stays a column. Returns -1 when nothing lies that way.
 */
export function pickNext(from: Rect, candidates: readonly Rect[], dir: Dir): number {
  const c = centre(from)
  let best = -1
  let bestScore = Infinity
  candidates.forEach((r, i) => {
    const p = centre(r)
    const dx = p.x - c.x
    const dy = p.y - c.y
    const along = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx)
    if (along <= 1) return
    const score = along + 2 * across
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  })
  return best
}

/** The candidate closest to a point (used to start from the middle of the screen when nothing is focused). */
export function nearestTo(x: number, y: number, candidates: readonly Rect[]): number {
  let best = -1
  let bestD = Infinity
  candidates.forEach((r, i) => {
    const p = centre(r)
    const d = (p.x - x) ** 2 + (p.y - y) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}
