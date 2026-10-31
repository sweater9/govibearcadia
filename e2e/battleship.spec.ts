import { expect, test, type Browser, type Page } from '@playwright/test'
import { createRandom } from '../src/lib/rng'
import { act, aiShot, newRoom, viewFor, type Room } from '../src/games/battleship/rules'
import { expectRows, readTable } from './helpers'

const SEED = 'e2e-bs'
const THINK = 600
const status = (p: Page) => p.locator('.c4-status')
const target = (p: Page, i: number) => p.locator(`[data-cell="${i}"]`)

test('plays a whole game against the computer with real clicks and saves the result once', async ({ page }) => {
  test.setTimeout(120_000)
  await page.clock.install({ time: new Date('2026-10-28T10:00:00Z') })
  await page.goto(`/play/battleship?seed=${SEED}`)
  await expect(page.locator('.bs-board')).toBeVisible()
  await page.clock.pauseAt(new Date('2026-10-28T10:00:30Z'))

  // The pure model deals the same fleets and answers the same way.
  const random = createRandom(SEED)
  let room: Room = newRoom(random)
  const mark = (r: ReturnType<typeof act>) => {
    if (!r.ok) throw new Error(r.error)
    room = r.room
  }
  await page.getByRole('button', { name: 'Ready' }).click()
  mark(act(room, 0, { type: 'ready' }, random))
  mark(act(room, 1, { type: 'ready' }, random))
  await expect(status(page)).toHaveText('Your shot')

  // The human hits every enemy ship cell, so the game ends in 17 of their shots.
  for (const cell of room.fleets[1].flat()) {
    if (room.phase !== 'battle') break
    await target(page, cell).click()
    mark(act(room, 0, { type: 'move', cell }))
    if (room.phase === 'battle') {
      mark(act(room, 1, { type: 'move', cell: aiShot(viewFor(room, 1), random) }))
      await page.clock.runFor(THINK)
    }
  }
  expect(room.winner).toBe(0)
  await expect(page.locator('.game-over').getByRole('heading', { name: 'You win!' })).toBeVisible()
  await expectRows(page, 'history', 1)
  const [row] = await readTable(page, 'history')
  expect(row).toMatchObject({ gameId: 'battleship', won: true })
  await page.clock.runFor(5000)
  await expectRows(page, 'history', 1)
})

test('the enemy waters are locked while the computer aims', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-28T10:00:00Z') })
  await page.goto(`/play/battleship?seed=${SEED}`)
  await page.clock.pauseAt(new Date('2026-10-28T10:00:30Z'))
  await page.getByRole('button', { name: 'Ready' }).click()
  await target(page, 0).click()
  await expect(status(page)).toHaveText('Computer is aiming…')
  await expect(target(page, 1)).toBeDisabled()
  await page.clock.runFor(THINK)
  await expect(status(page)).toHaveText('Your shot')
})

async function twoPlayers(browser: Browser, baseURL: string, mobile: boolean) {
  const opts = mobile ? { baseURL, viewport: { width: 393, height: 851 }, hasTouch: true } : { baseURL }
  const a = await (await browser.newContext(opts)).newPage()
  const b = await (await browser.newContext(opts)).newPage()
  const frames = { a: [] as string[], b: [] as string[] }
  for (const [who, page] of [['a', a], ['b', b]] as const) page.on('websocket', (ws) => ws.on('framereceived', (e) => frames[who].push(String(e.payload))))
  await a.goto('/online')
  await a.getByLabel('Game').selectOption('battleship')
  await a.getByRole('button', { name: 'Create a room' }).click()
  await expect(a).toHaveURL(/\/room\/[A-Z2-9]{6}\?g=battleship$/)
  const code = a.url().split('/').pop()!.split('?')[0]
  await b.goto(`/room/${code}?g=battleship`)
  return { a, b, frames }
}

const lastState = (frames: string[]) => {
  for (const f of [...frames].reverse()) {
    const m = JSON.parse(f)
    if (m.type === 'state') return m
  }
  return null
}

test('two players place, ready up, and shoot in turn; neither is ever sent the other’s ships', async ({ browser, baseURL, isMobile }) => {
  test.setTimeout(120_000)
  const { a, b, frames } = await twoPlayers(browser, baseURL!, !!isMobile)
  await expect(status(a)).toHaveText('Place your fleet')
  await expect(status(b)).toHaveText('Place your fleet')

  await a.getByRole('button', { name: 'Shuffle fleet' }).click()
  await a.getByRole('button', { name: 'Ready' }).click()
  await expect(status(a)).toHaveText('Waiting for your friend…')
  await expect(a.getByRole('button', { name: 'Ready' })).toBeDisabled()
  await b.getByRole('button', { name: 'Ready' }).click()
  await expect(status(a)).toHaveText('Your move')
  await expect(status(b)).toHaveText("Friend's move")
  await expect(target(b, 0)).toBeDisabled()

  const fleetA: number[] = lastState(frames.a).board.fleet.flat()
  const fleetB: number[] = lastState(frames.b).board.fleet.flat()
  expect(fleetA).toHaveLength(17)
  expect(fleetB).toHaveLength(17)

  // A hits every cell of B's fleet; B misses on cells that are water on A's board.
  const water = Array.from({ length: 100 }, (_, i) => i).filter((i) => !fleetA.includes(i))
  for (let k = 0; k < fleetB.length; k++) {
    await expect(status(a)).toHaveText('Your move')
    await target(a, fleetB[k]).click()
    if (k < fleetB.length - 1) {
      await expect(status(b)).toHaveText('Your move')
      await target(b, water[k]).click()
    }
  }
  await expect(status(a)).toHaveText('You win!')
  await expect(status(b)).toHaveText('You lose')
  await expect(a.getByLabel('Score')).toHaveText('1 – 0')
  await expectRows(a, 'history', 1)
  await expectRows(b, 'history', 1)

  // Every message either player received before the round ended: the other fleet was never in it.
  for (const [who, other] of [['a', fleetB], ['b', fleetA]] as const) {
    for (const raw of frames[who]) {
      const m = JSON.parse(raw)
      if (m.type !== 'state') continue
      const bd = m.board
      expect(Object.keys(bd).sort()).toEqual(['fleet', 'incoming', 'left', 'moves', 'phase', 'ready', 'reveal', 'shots', 'sunk'])
      if (bd.phase !== 'over') {
        expect(bd.reveal).toBeNull()
        const shotCells = new Set(bd.shots.map((s: { cell: number }) => s.cell))
        for (const ship of bd.sunk as number[][]) for (const c of ship) expect(shotCells.has(c)).toBe(true)
        // The only opponent ship cells a player may be told about are ones they shot.
        const told = JSON.stringify(bd.shots) + JSON.stringify(bd.sunk)
        for (const c of other) if (!shotCells.has(c)) expect(told).not.toContain(`"cell":${c},`)
      }
    }
  }

  await a.getByRole('button', { name: 'Rematch' }).click()
  await b.getByRole('button', { name: 'Accept rematch' }).click()
  await expect(status(a)).toHaveText('Place your fleet')
  await expect(status(b)).toHaveText('Place your fleet')
})

test('a reload during the battle keeps your fleet and shots', async ({ browser, baseURL, isMobile }) => {
  const { a, b, frames } = await twoPlayers(browser, baseURL!, !!isMobile)
  await a.getByRole('button', { name: 'Ready' }).click()
  await b.getByRole('button', { name: 'Ready' }).click()
  await expect(status(a)).toHaveText('Your move')
  await target(a, 55).click()
  await expect(status(b)).toHaveText('Your move')
  const fleetBefore = lastState(frames.a).board.fleet
  await a.reload()
  await expect(status(a)).toHaveText("Friend's move")
  await expect(a.locator('.bs-cell[data-state]')).toHaveCount(1)
  await a.getByRole('button', { name: 'Your fleet' }).click()
  expect(await a.locator('.bs-cell[data-ship]').count()).toBe(17)
  void fleetBefore
})
