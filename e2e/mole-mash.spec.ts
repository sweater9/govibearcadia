import { expect, test } from '@playwright/test'
import { expectRows, readTable } from './helpers'

const open = async (page: import('@playwright/test').Page) => {
  await page.clock.install() // fake timers, so runFor drives the game loop
  await page.goto('/play/mole-mash?seed=e2e-mole')
  await expect(page.locator('.mm-board')).toBeVisible()
}

test('tapping a mole scores, and the keys hit holes too', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Start' }).click()
  const target = await page.getByTestId('mm-target').getAttribute('data-colour')
  const mole = page.locator(`.mm-hole[data-kind="mole"][data-colour="${target}"], .mm-hole[data-kind="gold"][data-colour="${target}"]`).first()
  for (let i = 0; i < 40 && !(await mole.count()); i++) await page.clock.runFor(100)
  await expect(mole).toBeVisible()
  await mole.click()
  await expect(page.locator('.mm-stats')).toContainText(/Score\s*(10|30)/)
  // A number key whacks that hole; find whichever hole is popped and press its key.
  for (let i = 0; i < 40; i++) {
    const idx = await page.locator('.mm-hole').evaluateAll((els, c) => els.findIndex((e) => e.getAttribute('data-kind') === 'mole' && e.getAttribute('data-colour') === c), target)
    if (idx >= 0) {
      await page.keyboard.press(String(idx + 1))
      break
    }
    await page.clock.runFor(100)
  }
  await expect(page.locator('.mm-stats')).toContainText(/Score\s*(20|40|60)/)
  await expect(page.getByTestId('mm-streak')).toHaveText('2')
})

test('the round ends after the time limit, saves once, and Play again starts clean', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Start' }).click()
  for (let i = 0; i < 60 && !(await page.getByText("Time's up!").count()); i++) await page.clock.runFor(1000)
  await expect(page.getByText("Time's up!")).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'mole-mash', won: false })
  expect(Number(row.score)).toBe(0)

  await page.clock.runFor(10_000)
  await expectRows(page, 'history', 1)
  await page.getByRole('button', { name: 'Play again' }).click()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expectRows(page, 'history', 1)
})

test('three lost lives end the round early, show the lives, and are saved once', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Start' }).click()
  for (let hits = 0; hits < 3; hits++) {
    // Bombs cost a life whatever the target colour is, so the target changing mid-test cannot matter.
    const wrong = page.locator('.mm-hole[data-kind="bomb"]').first()
    for (let i = 0; i < 400 && !(await wrong.count()); i++) await page.clock.runFor(50)
    await wrong.click()
    await expect(page.getByTestId('mm-lives')).toHaveText(`${'♥'.repeat(2 - hits)}${'♡'.repeat(hits + 1)}`)
  }
  await expect(page.getByText('Out of lives!')).toBeVisible()
  await expectRows(page, 'history', 1)
  await page.clock.runFor(10_000)
  await expectRows(page, 'history', 1)
})
