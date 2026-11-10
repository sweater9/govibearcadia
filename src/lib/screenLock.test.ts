import { afterEach, expect, it } from 'vitest'
import { lockScreen, unlockScreen } from './screenLock'

afterEach(() => document.documentElement.classList.remove('screen-locked'))

it('locks and unlocks the page even when full screen and keep-awake are unavailable', async () => {
  await lockScreen()
  expect(document.documentElement.classList.contains('screen-locked')).toBe(true)
  await unlockScreen()
  expect(document.documentElement.classList.contains('screen-locked')).toBe(false)
})
