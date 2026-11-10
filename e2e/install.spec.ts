import { expect, test } from '@playwright/test'

test('the install card appears when the browser offers installation, installs on request and stays dismissed', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __prompted: number }).__prompted = 0
  })
  await page.goto('/')
  await expect(page.getByLabel('Install the arcade')).toHaveCount(0)
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
    e.prompt = async () => void ((window as unknown as { __prompted: number }).__prompted += 1)
    e.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(e)
  })
  const card = page.getByLabel('Install the arcade')
  await expect(card).toBeVisible()
  await card.getByRole('button', { name: 'Install', exact: true }).click()
  expect(await page.evaluate(() => (window as unknown as { __prompted: number }).__prompted)).toBe(1)
  await expect(card).toBeHidden()
})

test('dismissing the card remembers the choice', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
    e.prompt = async () => {}
    e.userChoice = Promise.resolve({ outcome: 'dismissed' })
    window.dispatchEvent(e)
  })
  await page.getByRole('button', { name: 'Dismiss install suggestion' }).click()
  await expect(page.getByLabel('Install the arcade')).toBeHidden()
  await page.reload()
  await page.evaluate(() => window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) })))
  await expect(page.getByLabel('Install the arcade')).toHaveCount(0)
})
