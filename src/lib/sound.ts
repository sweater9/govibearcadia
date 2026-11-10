/**
 * Optional sound effects, generated in the browser (no files, no network). Off by default; the choice is remembered on this device.
 * `attachGameSound` listens to a game's container, so every game gets sound without its own code.
 */
const KEY = 'govibearcadia.sound'
type Tone = [freq: number, ms: number, delay?: number]

export const SOUNDS = {
  tap: [[520, 40]],
  move: [[330, 60]],
  win: [[523, 110], [659, 110, 110], [784, 110, 220], [1047, 220, 330]],
  lose: [[330, 160], [262, 160, 150], [196, 280, 300]],
} as const satisfies Record<string, readonly Tone[]>
export type SoundName = keyof typeof SOUNDS

export function isSoundOn(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}
export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* private mode: the choice just is not remembered */
  }
}

let ctx: AudioContext | null = null

export function playSound(name: SoundName) {
  if (!isSoundOn()) return
  const Ctor = typeof window === 'undefined' ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
  if (!Ctor) return
  try {
    ctx ??= new Ctor()
    void ctx.resume()
    const t0 = ctx.currentTime
    for (const [freq, ms, delay = 0] of SOUNDS[name] as readonly Tone[]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = t0 + delay / 1000
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + ms / 1000)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + ms / 1000 + 0.02)
    }
  } catch {
    /* audio is a nicety: never let it break a game */
  }
}

/** Win or lose, judged from the end-of-game panel's heading. */
export const isWinText = (text: string) => /\b(win|wins|won|perfect|cleared|solved|victory)\b/i.test(text) && !/computer wins/i.test(text)

/** Taps and keys make a soft click; an end-of-game panel plays a win or lose tune. Returns a cleanup function. */
export function attachGameSound(root: HTMLElement): () => void {
  const onTap = (e: Event) => {
    const el = e.target as HTMLElement | null
    if (el?.closest('button, [role="button"]') && !el.closest('.game-over')) playSound('tap')
  }
  const onKey = (e: KeyboardEvent) => {
    if (/^(Arrow|[1-9]$| $)/.test(e.key) || e.key === ' ') playSound('move')
  }
  root.addEventListener('click', onTap)
  addEventListener('keydown', onKey)
  let announced = false
  const observer = new MutationObserver(() => {
    const panel = root.querySelector('.game-over, .win-message')
    if (!panel && announced) announced = false
    if (panel && !announced) {
      announced = true
      playSound(isWinText(panel.textContent ?? '') || panel.matches('.win-message') ? 'win' : 'lose')
    }
  })
  observer.observe(root, { childList: true, subtree: true })
  return () => {
    root.removeEventListener('click', onTap)
    removeEventListener('keydown', onKey)
    observer.disconnect()
  }
}
