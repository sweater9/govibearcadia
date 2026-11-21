import { expect, test, type Page } from '@playwright/test'
import { campaignLevel } from '../src/games/maze/levels'
import { DIRS, DIR_LIST, coverRoute } from '../src/games/maze/rules'
import { expectRows, readTable } from './helpers'

const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const
const steps = async (page: Page) => Number(await page.locator('.mz-stage').getAttribute('data-steps'))

/** Presses one arrow key per cell along the real solution of the level and waits for each step to land. */
async function solve(page: Page, n: number) {
  const l = campaignLevel(n)
  const cells = coverRoute(l)
  for (let i = 1; i < cells.length; i++) {
    const dx = (cells[i] % l.w) - (cells[i - 1] % l.w)
    const dy = Math.floor(cells[i] / l.w) - Math.floor(cells[i - 1] / l.w)
    const d = DIR_LIST.find((x) => DIRS[x].dx === dx && DIRS[x].dy === dy) as keyof typeof KEY
    const before = await steps(page)
    await page.keyboard.press(KEY[d])
    await expect.poll(() => steps(page), { timeout: 3000 }).toBe(before + 1)
  }
}

test('clears level 1 (practice, no chasers) with the real keyboard, saves the result once and unlocks level 2', async ({ page }) => {
  await page.addInitScript(() => { if (!localStorage.getItem('govibearcadia.maze')) localStorage.setItem('govibearcadia.maze', JSON.stringify({ unlocked: 1, levels: {}, coins: 0, endless: { top: [] }, achievements: [], settings: { difficulty: 'practice', dpad: false } })) })
  await page.goto('/play/maze-runner?seed=e2e-maze')
  await expect(page.locator('.mz-board')).toBeVisible()
  await solve(page, 1)
  await expect(page.locator('.mz-stage')).toHaveAttribute('data-pellets', '0')
  await expect(page.getByRole('dialog', { name: 'Level cleared' })).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'maze-runner' })
  await page.waitForTimeout(600)
  await expectRows(page, 'history', 1)
  await page.getByRole('button', { name: 'Levels' }).last().click()
  await expect(page.getByRole('button', { name: /^Level 2(,|$)/ })).toBeEnabled()
  await expect(page.getByRole('button', { name: /^Level 3, locked/ })).toBeDisabled()
  // Progress is kept across a reload.
  await page.reload()
  await expect(page.getByText('Level 2', { exact: true })).toBeVisible()
})

test('on-screen pad buttons move the runner', async ({ page }) => {
  await page.goto('/play/maze-runner?seed=e2e-maze-pad')
  await page.getByRole('button', { name: 'Levels' }).click()
  await page.getByLabel('Show the on-screen pad').check()
  await page.getByRole('button', { name: 'Back to the maze' }).click()
  const l = campaignLevel(1)
  const wall = l.walls[l.start.y * l.w + l.start.x]
  const open = DIR_LIST.find((d) => !(wall & DIRS[d].bit) && l.start.y + DIRS[d].dy >= 0 && l.start.y + DIRS[d].dy < l.h && l.start.x + DIRS[d].dx >= 0) as keyof typeof KEY
  await page.getByRole('button', { name: `Move ${open}` }).click()
  await expect.poll(() => steps(page)).toBe(1)
})

test('pause stops the game and Escape resumes it', async ({ page }) => {
  await page.goto('/play/maze-runner?seed=e2e-maze-pause')
  await expect(page.locator('.mz-board')).toBeVisible()
  await page.keyboard.press('p')
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Paused' })).toHaveCount(0)
})

test('Endless starts a new maze from the menu', async ({ page }) => {
  await page.goto('/play/maze-runner?seed=e2e-endless')
  await page.getByRole('button', { name: 'Levels' }).click()
  await page.getByRole('button', { name: 'Start Endless' }).click()
  await expect(page.getByText('Maze 1', { exact: true })).toBeVisible()
  await expect(page.locator('.mz-board')).toBeVisible()
})
