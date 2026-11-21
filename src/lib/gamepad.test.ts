import { describe, expect, it } from 'vitest'
import { BUTTON, REPEAT_DELAY_MS, REPEAT_RATE_MS, heldDirection, initialPadState, nearestTo, pickNext, stepPad, type PadSnapshot, type Rect } from './gamepad'

const snap = (pressed: number[] = [], axes: number[] = [0, 0]): PadSnapshot => ({ buttons: Array.from({ length: 17 }, (_, i) => pressed.includes(i)), axes })
const box = (x: number, y: number, w = 40, h = 40): Rect => ({ left: x, top: y, right: x + w, bottom: y + h })

describe('heldDirection', () => {
  it('reads the D-pad', () => expect(heldDirection(snap([BUTTON.LEFT]))).toBe('left'))
  it('ignores a stick inside the deadzone', () => expect(heldDirection(snap([], [0.3, -0.4]))).toBeNull())
  it('uses the stronger stick axis', () => {
    expect(heldDirection(snap([], [0.9, -0.6]))).toBe('right')
    expect(heldDirection(snap([], [0.5, -0.8]))).toBe('up')
  })
  it('lets the D-pad win over the stick', () => expect(heldDirection(snap([BUTTON.DOWN], [-1, 0]))).toBe('down'))
})

describe('stepPad', () => {
  it('fires a button once per press, not while held', () => {
    let st = initialPadState()
    let r = stepPad(st, snap([BUTTON.A]), 0)
    expect(r.actions).toEqual([{ type: 'confirm' }])
    st = r.state
    r = stepPad(st, snap([BUTTON.A]), 16)
    expect(r.actions).toEqual([])
    st = r.state
    st = stepPad(st, snap(), 32).state
    expect(stepPad(st, snap([BUTTON.A]), 48).actions).toEqual([{ type: 'confirm' }])
  })
  it('maps the other buttons', () => {
    const one = (b: number) => stepPad(initialPadState(), snap([b]), 0).actions
    expect(one(BUTTON.B)).toEqual([{ type: 'back' }])
    expect(one(BUTTON.X)).toEqual([{ type: 'enter' }])
    expect(one(BUTTON.Y)).toEqual([{ type: 'pause' }])
    expect(one(BUTTON.START)).toEqual([{ type: 'pause' }])
    expect(one(BUTTON.LB)).toEqual([{ type: 'tab', back: true }])
    expect(one(BUTTON.RB)).toEqual([{ type: 'tab', back: false }])
  })
  it('moves once, then repeats after the delay at the repeat rate', () => {
    let st = initialPadState()
    let r = stepPad(st, snap([BUTTON.RIGHT]), 1000)
    expect(r.actions).toEqual([{ type: 'dir', dir: 'right', repeat: false }])
    st = r.state
    r = stepPad(st, snap([BUTTON.RIGHT]), 1000 + REPEAT_DELAY_MS - 1)
    expect(r.actions).toEqual([])
    st = r.state
    r = stepPad(st, snap([BUTTON.RIGHT]), 1000 + REPEAT_DELAY_MS)
    expect(r.actions).toEqual([{ type: 'dir', dir: 'right', repeat: true }])
    st = r.state
    expect(stepPad(st, snap([BUTTON.RIGHT]), 1000 + REPEAT_DELAY_MS + REPEAT_RATE_MS - 1).actions).toEqual([])
    expect(stepPad(st, snap([BUTTON.RIGHT]), 1000 + REPEAT_DELAY_MS + REPEAT_RATE_MS).actions).toHaveLength(1)
  })
  it('a new direction fires immediately and restarts the delay', () => {
    let st = stepPad(initialPadState(), snap([BUTTON.RIGHT]), 0).state
    const r = stepPad(st, snap([BUTTON.DOWN]), 100)
    expect(r.actions).toEqual([{ type: 'dir', dir: 'down', repeat: false }])
    st = r.state
    expect(stepPad(st, snap([BUTTON.DOWN]), 100 + REPEAT_DELAY_MS - 1).actions).toEqual([])
  })
  it('releasing stops everything', () => {
    const st = stepPad(initialPadState(), snap([BUTTON.RIGHT]), 0).state
    expect(stepPad(st, snap(), 900).actions).toEqual([])
  })
})

describe('pickNext', () => {
  // A 3x2 grid of buttons.
  const grid = [box(0, 0), box(60, 0), box(120, 0), box(0, 60), box(60, 60), box(120, 60)]
  it('moves along a row and down a column', () => {
    expect(pickNext(grid[0], grid, 'right')).toBe(1)
    expect(pickNext(grid[1], grid, 'right')).toBe(2)
    expect(pickNext(grid[1], grid, 'left')).toBe(0)
    expect(pickNext(grid[1], grid, 'down')).toBe(4)
    expect(pickNext(grid[5], grid, 'up')).toBe(2)
  })
  it('returns -1 at the edge', () => {
    expect(pickNext(grid[2], grid, 'right')).toBe(-1)
    expect(pickNext(grid[0], grid, 'up')).toBe(-1)
  })
  it('prefers staying in the column over a slightly nearer button off to the side', () => {
    const cur = box(100, 0)
    const sameColumn = box(100, 200)
    const nearSide = box(190, 60)
    expect(pickNext(cur, [sameColumn, nearSide], 'down')).toBe(0)
  })
})

describe('nearestTo', () => {
  it('finds the closest button to a point', () => expect(nearestTo(125, 20, [box(0, 0), box(100, 0), box(300, 300)])).toBe(1))
  it('returns -1 with nothing to pick', () => expect(nearestTo(0, 0, [])).toBe(-1))
})
