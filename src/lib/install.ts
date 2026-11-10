/** Install-to-home-screen helpers. Chrome and Android offer a prompt we can trigger; iPhone Safari only has the Share menu, so we explain it. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
const DISMISSED = 'govibearcadia.install.dismissed'

let deferred: InstallEvent | null = null
const listeners = new Set<() => void>()

export function watchInstall() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}
export const onInstallChange = (fn: () => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}
export const canPromptInstall = () => deferred !== null
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  listeners.forEach((l) => l())
  return outcome === 'accepted'
}

export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
export const isIosSafari = (ua = typeof navigator === 'undefined' ? '' : navigator.userAgent) => /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)

export function installDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED) === '1'
  } catch {
    return false
  }
}
export function dismissInstall() {
  try {
    localStorage.setItem(DISMISSED, '1')
  } catch {
    /* not remembered in private mode */
  }
}
