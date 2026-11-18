import { expect, test, type Page } from '@playwright/test'
import { isRoomCode } from '../src/lib/roomcode'

// Slice M2: the Matchmaker Durable Object, exercised through the real Workers runtime (no screens yet).
// The e2e server shortens the wait to 4 seconds (MATCH_WAIT_MS in playwright.config.ts).

type Msg = Record<string, unknown>
const tok = (name: string) => `${name}-${Math.random().toString(36).slice(2, 10)}`.padEnd(20, 'x')

const open = (page: Page, name: string, game: string, token: string) =>
  page.evaluate(
    ([n, g, t]) =>
      new Promise<boolean>((resolve) => {
        const w = window as unknown as Record<string, { ws: WebSocket; log: Record<string, unknown>[] }>
        const ws = new WebSocket(`${location.origin.replace('http', 'ws')}/api/match/${g}/ws?t=${t}`)
        const log: Record<string, unknown>[] = []
        w[n] = { ws, log }
        ws.onmessage = (e) => log.push(JSON.parse(e.data))
        ws.onclose = (e) => log.push({ closed: e.code })
        ws.onopen = () => resolve(true)
        ws.onerror = () => resolve(false)
      }),
    [name, game, token] as const,
  )
const send = (page: Page, name: string, data: unknown) => page.evaluate(([n, d]) => (window as unknown as Record<string, { ws: WebSocket }>)[n].ws.send(JSON.stringify(d)), [name, data] as const)
const log = (page: Page, name: string) => page.evaluate((n) => (window as unknown as Record<string, { log: Msg[] }>)[n].log, name)
const waitFor = (page: Page, name: string, pred: (m: Msg) => boolean) => expect.poll(async () => (await log(page, name)).find(pred), { timeout: 8000 }).toBeTruthy()
const status = (page: Page) => page.evaluate(async () => (await (await fetch('/api/match/status', { cache: 'no-store' })).json()) as { waiting: Record<string, number> })
const raw = (page: Page, path: string) => page.evaluate(async (p) => ({ status: (await fetch(p)).status }), path)

test('two players who join are given the same valid room code, and that room works', async ({ page }) => {
  await page.goto('/')
  const [ta, tb] = [tok('alice'), tok('bobby')]
  expect(await open(page, 'a', 'connect-four', ta)).toBe(true)
  await send(page, 'a', { type: 'join' })
  await waitFor(page, 'a', (m) => m.type === 'waiting' && m.count === 1)

  expect(await open(page, 'b', 'connect-four', tb)).toBe(true)
  await send(page, 'b', { type: 'join' })
  await waitFor(page, 'a', (m) => m.type === 'matched')
  await waitFor(page, 'b', (m) => m.type === 'matched')
  const codeA = (await log(page, 'a')).find((m) => m.type === 'matched')!.code as string
  const codeB = (await log(page, 'b')).find((m) => m.type === 'matched')!.code as string
  expect(isRoomCode(codeA)).toBe(true)
  expect(codeA).toBe(codeB)

  // The code leads into the normal room, which seats both players.
  const joinRoom = (n: string, t: string) =>
    page.evaluate(
      ([name, token, code]) =>
        new Promise<void>((resolve) => {
          const w = window as unknown as Record<string, { log: Record<string, unknown>[] }>
          const ws = new WebSocket(`${location.origin.replace('http', 'ws')}/api/rooms/${code}/ws?g=connect-four&t=${token}`)
          w[name] = { log: [] }
          ws.onmessage = (e) => w[name].log.push(JSON.parse(e.data))
          ws.onopen = () => resolve()
        }),
      [n, t, codeA] as const,
    )
  await joinRoom('ra', ta)
  await joinRoom('rb', tb)
  await expect.poll(async () => ((await log(page, 'rb')).filter((m) => m.type === 'state').at(-1) as { connected?: boolean[] } | undefined)?.connected).toEqual([true, true])
  expect((await status(page)).waiting['connect-four']).toBe(0)
})

test('a player who rejoins just after being matched gets the same room code back', async ({ page }) => {
  await page.goto('/')
  const [ta, tb] = [tok('carol'), tok('dave')]
  await open(page, 'a', 'checkers', ta)
  await send(page, 'a', { type: 'join' })
  await waitFor(page, 'a', (m) => m.type === 'waiting')
  await open(page, 'b', 'checkers', tb)
  await send(page, 'b', { type: 'join' })
  await waitFor(page, 'a', (m) => m.type === 'matched')
  const code = (await log(page, 'a')).find((m) => m.type === 'matched')!.code
  await open(page, 'a2', 'checkers', ta)
  await send(page, 'a2', { type: 'join' })
  await waitFor(page, 'a2', (m) => m.type === 'matched' && m.code === code)
})

test('the same token twice does not match itself: the second tab replaces the first', async ({ page }) => {
  await page.goto('/')
  const t = tok('erin')
  await open(page, 'a', 'tic-tac-toe', t)
  await send(page, 'a', { type: 'join' })
  await waitFor(page, 'a', (m) => m.type === 'waiting')
  await open(page, 'a2', 'tic-tac-toe', t)
  await waitFor(page, 'a', (m) => m.closed === 4000)
  await send(page, 'a2', { type: 'join' })
  await waitFor(page, 'a2', (m) => m.type === 'waiting' && m.count === 1)
  expect((await log(page, 'a2')).some((m) => m.type === 'matched')).toBe(false)
  await send(page, 'a2', { type: 'leave' })
})

test('the waiting count follows joins and leaves, per game', async ({ page }) => {
  await page.goto('/')
  expect((await status(page)).waiting).toMatchObject({ battleship: 0, 'nine-mens-morris': 0 })
  await open(page, 'a', 'nine-mens-morris', tok('frank'))
  await send(page, 'a', { type: 'join' })
  await expect.poll(async () => (await status(page)).waiting['nine-mens-morris']).toBe(1)
  expect((await status(page)).waiting.battleship).toBe(0)
  await send(page, 'a', { type: 'leave' })
  await expect.poll(async () => (await status(page)).waiting['nine-mens-morris']).toBe(0)
})

test('a player nobody pairs with is told it timed out and leaves the queue', async ({ page }) => {
  await page.goto('/')
  await open(page, 'a', 'battleship', tok('gina'))
  await send(page, 'a', { type: 'join' })
  await waitFor(page, 'a', (m) => m.type === 'waiting')
  await waitFor(page, 'a', (m) => m.type === 'timeout')
  await expect.poll(async () => (await status(page)).waiting.battleship).toBe(0)
})

test('a player who closes the tab leaves the queue, so the next player is not paired with a ghost', async ({ page }) => {
  await page.goto('/')
  await open(page, 'a', 'connect-four', tok('hank'))
  await send(page, 'a', { type: 'join' })
  await waitFor(page, 'a', (m) => m.type === 'waiting')
  await page.evaluate(() => (window as unknown as Record<string, { ws: WebSocket }>).a.ws.close())
  await expect.poll(async () => (await status(page)).waiting['connect-four']).toBe(0)
})

test('bad requests are rejected as JSON and the rooms API is untouched', async ({ page }) => {
  await page.goto('/')
  expect(await raw(page, '/api/match/chess/ws')).toEqual({ status: 400 })
  expect(await raw(page, '/api/match/world-trip/ws')).toEqual({ status: 400 })
  expect(await raw(page, '/api/match/connect-four/ws?t=short')).toEqual({ status: 426 }) // not a WebSocket upgrade
  expect(await raw(page, '/api/match/nope')).toEqual({ status: 404 })
  const bad = await page.evaluate(() => new Promise<boolean>((resolve) => { const ws = new WebSocket(`${location.origin.replace('http', 'ws')}/api/match/connect-four/ws?t=short`); ws.onopen = () => resolve(true); ws.onerror = () => resolve(false) }))
  expect(bad).toBe(false)
  expect((await page.evaluate(async () => (await fetch('/api/health')).status))).toBe(200)
})
