import { afterEach, describe, expect, it } from 'vitest'
import { dismissInstall, installDismissed, isIosSafari } from './install'

afterEach(() => localStorage.clear())

describe('install helpers', () => {
  it('recognises iPhone Safari but not iOS Chrome or desktop', () => {
    expect(isIosSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe(true)
    expect(isIosSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1')).toBe(false)
    expect(isIosSafari('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36')).toBe(false)
  })
  it('remembers a dismissal', () => {
    expect(installDismissed()).toBe(false)
    dismissInstall()
    expect(installDismissed()).toBe(true)
  })
})
