import { expect, test, type Page } from '@playwright/test'
import { ANSWERS } from '../src/games/wordle/words'
import { evaluate, pickAnswer, scoreFor, newGame, submit, typeLetter } from '../src/games/wordle/rules'
import { expectRows, readTable } from './helpers'

const SEED = 'e2e-word'
const row = (page: Page, r: number) => page.locator(`[data-row="${r}"] .wordle-tile`)

test('a wrong guess is marked by the rules, then the answer wins and is saved once', async ({ page }) => {
  const answer = pickAnswer(SEED)
  const wrong = ANSWERS.find((w) => w !== answer)!
  await page.goto(`/play/daily-word?seed=${SEED}`)
  await expect(page.locator('.wordle-grid')).toBeVisible()

  await page.keyboard.type(wrong)
  await page.keyboard.press('Enter')
  const expected = evaluate(wrong, answer)
  for (let c = 0; c < 5; c++) await expect(row(page, 0).nth(c)).toHaveAttribute('data-state', expected[c])
  await expectRows(page, 'history', 0)

  await page.keyboard.type(answer)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Got it!' })).toBeVisible()
  await expectRows(page, 'history', 1)
  const model = [wrong, answer].reduce((s, w) => submit([...w].reduce(typeLetter, s)), newGame(answer))
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'daily-word', won: true, score: scoreFor(model) })
})

test('short and unknown words are refused, backspace edits, and nothing is saved', async ({ page }) => {
  await page.goto(`/play/daily-word?seed=${SEED}`)
  await expect(page.locator('.wordle-grid')).toBeVisible() // the game chunk is lazy: wait before typing
  await page.keyboard.type('ab')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Not enough letters')).toBeVisible()
  await page.keyboard.type('xyz')
  await page.keyboard.press('Enter')
  await expect(page.getByText('Not in the word list')).toBeVisible()
  await page.keyboard.press('Backspace')
  await expect(row(page, 0).nth(4)).toHaveText('')
  await expect(row(page, 1).nth(0)).toHaveAttribute('data-state', 'empty')
  await expectRows(page, 'history', 0)
})

test('the on-screen keyboard plays a full loss and reveals the word', async ({ page }) => {
  const answer = pickAnswer(SEED)
  await page.goto(`/play/daily-word?seed=${SEED}`)
  const wrong = ANSWERS.filter((w) => w !== answer).slice(0, 6)
  for (const word of wrong) {
    for (const ch of word) await page.locator(`[data-key="${ch}"]`).click()
    await page.locator('[data-key="Enter"]').click()
  }
  await expect(page.getByText(`The word was ${answer.toUpperCase()}`)).toBeVisible()
  await expectRows(page, 'history', 1)
  expect((await readTable(page, 'history'))[0]).toMatchObject({ gameId: 'daily-word', won: false, score: 0 })
  await expect(page.locator('[data-key]').first()).toBeVisible()
})

test('with no seed the word is the UTC date word, the same on every visit that day', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-28T22:30:00Z') })
  await page.goto('/play/daily-word')
  await expect(page.locator('.wordle-grid')).toBeVisible()
  await expect(page.getByText('Word of the day · 2026-10-28')).toBeVisible()
  await page.keyboard.type(pickAnswer('2026-10-28'))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Got it!' })).toBeVisible()
})
