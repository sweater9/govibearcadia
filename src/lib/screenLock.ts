/**
 * "Fit to screen": while locked the page cannot scroll, pull-to-refresh or pinch-zoom, the site chrome is hidden and the game fills the screen.
 * Full screen and keep-awake are used where the browser offers them (not all phones do), and are always released on unlock.
 */
type WakeLockLike = { release: () => Promise<void> }
let wake: WakeLockLike | null = null

export async function lockScreen() {
  document.documentElement.classList.add('screen-locked')
  try {
    await document.documentElement.requestFullscreen?.()
  } catch {
    /* not allowed or not supported: the in-page lock still works */
  }
  try {
    wake = (await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockLike> } }).wakeLock?.request('screen')) ?? null
  } catch {
    wake = null
  }
}

export async function unlockScreen() {
  document.documentElement.classList.remove('screen-locked')
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
  } catch {
    /* already out */
  }
  try {
    await wake?.release()
  } catch {
    /* already released */
  }
  wake = null
}
