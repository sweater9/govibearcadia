import { useEffect, useState } from 'react'
import { initialPadState, nearestTo, pickNext, stepPad, type Dir, type PadAction, type PadSnapshot, type PadState } from '../lib/gamepad'

const ARROW: Record<Dir, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }
const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]'
const CLICKABLE = 'button, a[href], summary, [role="button"], input[type="checkbox"], input[type="radio"], input[type="button"], input[type="submit"]'

/** Sends a key press to whatever has focus (or the page), so games that listen for keys work with a controller. */
function press(key: string, repeat = false): boolean {
  const target: EventTarget = document.activeElement ?? document.body
  const down = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, repeat })
  target.dispatchEvent(down)
  target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, cancelable: true }))
  return down.defaultPrevented
}

function focusables(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.matches(':disabled') || el.getAttribute('tabindex') === '-1' || el.classList.contains('skip-link') || el.closest('[aria-hidden="true"], [inert]')) return false
    if (el instanceof HTMLInputElement && el.type === 'hidden') return false
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
  })
}

function focusEl(el: HTMLElement) {
  el.focus()
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
}

/** Moves the focus ring to the nearest control in a direction; from nothing it starts near the middle of the screen. */
function moveFocus(dir: Dir) {
  const list = focusables()
  if (!list.length) return
  const rects = list.map((el) => el.getBoundingClientRect())
  const active = document.activeElement
  const from = active && active !== document.body ? list.indexOf(active as HTMLElement) : -1
  if (from < 0) {
    const i = nearestTo(innerWidth / 2, innerHeight / 2, rects)
    if (i >= 0) focusEl(list[i])
    return
  }
  const rest = list.filter((_, i) => i !== from)
  const restRects = rects.filter((_, i) => i !== from)
  const i = pickNext(rects[from], restRects, dir)
  if (i >= 0) focusEl(rest[i])
}

function cycleFocus(back: boolean) {
  const list = focusables()
  if (!list.length) return
  const at = list.indexOf(document.activeElement as HTMLElement)
  focusEl(list[(at + (back ? -1 : 1) + list.length * 2) % list.length])
}

/** A focused dropdown cannot be opened by a script, so the stick changes its value instead. */
function nudgeSelect(sel: HTMLSelectElement, dir: Dir): boolean {
  const step = dir === 'up' || dir === 'left' ? -1 : dir === 'down' || dir === 'right' ? 1 : 0
  const next = sel.selectedIndex + step
  if (next < 0 || next >= sel.options.length) return true
  sel.selectedIndex = next
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  return true
}

function run(action: PadAction) {
  const active = document.activeElement as HTMLElement | null
  switch (action.type) {
    case 'dir': {
      if (active instanceof HTMLSelectElement && nudgeSelect(active, action.dir)) return
      // A game that uses the arrows claims the key; otherwise the arrows move the focus ring.
      if (!press(ARROW[action.dir], action.repeat)) moveFocus(action.dir)
      return
    }
    case 'confirm':
    case 'enter': {
      if (active && active.matches(CLICKABLE)) return active.click()
      press(action.type === 'confirm' ? ' ' : 'Enter')
      return
    }
    case 'back':
      if (!press('Escape') && location.pathname !== '/' && !location.pathname.startsWith('/play/')) history.back()
      return
    case 'pause':
      press('p')
      return
    case 'tab':
      return cycleFocus(action.back)
  }
}

const snapshotOf = (pad: Gamepad): PadSnapshot => ({ buttons: Array.from(pad.buttons, (b) => b.pressed), axes: Array.from(pad.axes) })

/**
 * Lets a game controller drive the whole arcade. It only polls while a controller is connected. Everything it does is
 * a keyboard press or a focus move, so each game's own keyboard controls are the single source of truth.
 */
export function GamepadBridge() {
  const [connected, setConnected] = useState(false)
  const [announce, setAnnounce] = useState('')

  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return
    const count = () => Array.from(navigator.getGamepads()).filter(Boolean).length
    const onConnect = () => {
      setConnected(true)
      setAnnounce('Controller connected. Use the D-pad to move, A to select, B to go back.')
    }
    const onDisconnect = () => {
      const any = count() > 0
      setConnected(any)
      if (!any) setAnnounce('Controller disconnected.')
    }
    if (count() > 0) setConnected(true)
    addEventListener('gamepadconnected', onConnect)
    addEventListener('gamepaddisconnected', onDisconnect)
    return () => {
      removeEventListener('gamepadconnected', onConnect)
      removeEventListener('gamepaddisconnected', onDisconnect)
    }
  }, [])

  useEffect(() => {
    if (!connected) return
    const root = document.documentElement
    let state: PadState = initialPadState()
    let raf = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (document.hidden) return
      const pad = Array.from(navigator.getGamepads()).find((p): p is Gamepad => !!p && p.connected)
      if (!pad) return
      const r = stepPad(state, snapshotOf(pad), now)
      state = r.state
      if (r.actions.length) root.dataset.input = 'pad'
      for (const a of r.actions) run(a)
    }
    raf = requestAnimationFrame(tick)
    // A real mouse, finger or keyboard puts the page back to its normal focus look.
    const off = (e: Event) => {
      if (e.isTrusted) delete root.dataset.input
    }
    addEventListener('pointerdown', off)
    addEventListener('keydown', off)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('pointerdown', off)
      removeEventListener('keydown', off)
      delete root.dataset.input
    }
  }, [connected])

  return (
    <div className="sr-only" aria-live="polite">
      {announce}
    </div>
  )
}
