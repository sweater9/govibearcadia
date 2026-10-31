import { expect, test, type Page } from '@playwright/test'
import { isRoomCode } from '../src/lib/roomcode'

// Slice 3.0: the Worker and the Room Durable Object, exercised through the real Workers runtime.

const api = (page: Page, path: string, init?: { method?: string }) =>
  page.evaluate(async ([p, i]) => {
    const r = await fetch(p as string, i as RequestInit)
    return { status: r.status, type: r.headers.get('content-type'), body: await r.text() }
  }, [path, init ?? {}] as const)

/** Opens a socket in the page for a player token, collects every message, and exposes it on window. */
const connect = (page: Page, name: string, code: string, token = name.padEnd(20, 'x'), game = 'connect-four') =>
  page.evaluate(
    ([n, c, t, g]) =>
      new Promise<{ ok: boolean }>((resolve) => {
        const w = window as unknown as Record<string, { ws: WebSocket; log: Record<string, unknown>[] }>
        const ws = new WebSocket(`${location.origin.replace('http', 'ws')}/api/rooms/${c}/ws?g=${g}&t=${t}`)
        const log: Record<string, unknown>[] = []
        w[n] = { ws, log }
        ws.onmessage = (e) => log.push(JSON.parse(e.data))
        ws.onclose = (e) => log.push({ closed: e.code })
        ws.onopen = () => resolve({ ok: true })
        ws.onerror = () => resolve({ ok: false })
      }),
    [name, code, token, game] as const,
  )
const log = (page: Page, name: string) => page.evaluate((n) => (window as unknown as Record<string, { log: Record<string, unknown>[] }>)[n].log, name)
const states = async (page: Page, name: string) => (await log(page, name)).filter((m) => m.type === 'state')
const last = async (page: Page, name: string) => (await states(page, name)).at(-1) as Record<string, any> | undefined // eslint-disable-line @typescript-eslint/no-explicit-any
const send = (page: Page, name: string, data: unknown) => page.evaluate(([n, d]) => (window as unknown as Record<string, { ws: WebSocket }>)[n].ws.send(typeof d === 'string' ? d : JSON.stringify(d)), [name, data] as const)
const newRoom = async (page: Page) => JSON.parse((await api(page, '/api/rooms', { method: 'POST' })).body).code as string

test('health check answers without cache', async ({ page }) => {
  await page.goto('/')
  const r = await api(page, '/api/health')
  expect(r.status).toBe(200)
  expect(JSON.parse(r.body)).toEqual({ ok: true, service: 'govibearcadia', protocol: 1 })
})

test('creating a room returns a valid code, and each call is different', async ({ page }) => {
  await page.goto('/')
  const a = JSON.parse((await api(page, '/api/rooms', { method: 'POST' })).body).code
  const b = JSON.parse((await api(page, '/api/rooms', { method: 'POST' })).body).code
  expect(isRoomCode(a)).toBe(true)
  expect(a).not.toBe(b)
})

test('unknown API paths and bad room codes are rejected as JSON, and the site itself is untouched', async ({ page }) => {
  await page.goto('/')
  expect((await api(page, '/api/nope'))).toMatchObject({ status: 404, type: expect.stringContaining('json') })
  expect((await api(page, '/api/rooms/abc/ws'))).toMatchObject({ status: 400 })
  expect((await api(page, '/api/rooms/ABCDE0/ws'))).toMatchObject({ status: 400 })
  // A direct deep link still falls back to the app, as before.
  const r = await page.goto('/play/carve')
  expect(r?.status()).toBe(200)
  await expect(page.locator('.cv-board')).toBeVisible()
})

test('two players get seats and see each other; a third is turned away', async ({ page }) => {
  await page.goto('/')
  const code = await newRoom(page)
  expect(await connect(page, 'p1', code)).toEqual({ ok: true })
  await expect.poll(() => last(page, 'p1')).toMatchObject({ type: 'state', you: 0, yourColour: 1, turn: 0, connected: [true, false], round: 1, wins: [0, 0] })
  expect(await connect(page, 'p2', code)).toEqual({ ok: true })
  await expect.poll(() => last(page, 'p2')).toMatchObject({ you: 1, yourColour: 2, turn: 0, connected: [true, true] })
  await expect.poll(() => last(page, 'p1')).toMatchObject({ connected: [true, true] })
  expect(await connect(page, 'p3', code)).toEqual({ ok: false }) // room is full (409)
})

test('the server decides: out-of-turn, illegal and unknown messages are refused and change nothing', async ({ page }) => {
  await page.goto('/')
  const code = await newRoom(page)
  await connect(page, 'p1', code)
  await connect(page, 'p2', code)
  await expect.poll(() => last(page, 'p2')).toMatchObject({ connected: [true, true] })

  await send(page, 'p2', { type: 'move', col: 3 }) // not seat 1's turn
  await expect.poll(async () => (await log(page, 'p2')).filter((m) => m.type === 'error')).toEqual([{ type: 'error', code: 'not-your-turn' }])
  await send(page, 'p1', { type: 'move', col: 99 })
  await send(page, 'p1', { type: 'move', col: '3' })
  await send(page, 'p1', { type: 'cheat' })
  await send(page, 'p1', { type: 'rematch' }) // game not over
  await expect.poll(async () => (await log(page, 'p1')).filter((m) => m.type === 'error').map((m) => m.code)).toEqual(['illegal-move', 'illegal-move', 'unknown-message', 'game-not-over'])
  expect((await last(page, 'p1'))?.moves).toBe(0)

  await send(page, 'p1', { type: 'move', col: 3 })
  await expect.poll(() => last(page, 'p2')).toMatchObject({ moves: 1, turn: 1 })
  expect((await last(page, 'p2'))?.cells[38]).toBe(1) // bottom row, column 3
})

test('a full game: red wins, the tally updates, and the other seat starts the rematch', async ({ page }) => {
  await page.goto('/')
  const code = await newRoom(page)
  await connect(page, 'p1', code)
  await connect(page, 'p2', code)
  for (const [who, col] of [['p1', 0], ['p2', 1], ['p1', 0], ['p2', 1], ['p1', 0], ['p2', 1], ['p1', 0]] as const) {
    await send(page, who, { type: 'move', col })
    await expect.poll(async () => (await last(page, who))?.moves).toBeGreaterThan(0)
  }
  await expect.poll(() => last(page, 'p2')).toMatchObject({ winner: 0, turn: null, wins: [1, 0] })
  await send(page, 'p2', { type: 'move', col: 2 })
  await expect.poll(async () => (await log(page, 'p2')).filter((m) => m.type === 'error').at(-1)).toEqual({ type: 'error', code: 'game-over' })

  await send(page, 'p1', { type: 'rematch' })
  await expect.poll(() => last(page, 'p2')).toMatchObject({ rematch: [true, false] })
  await send(page, 'p2', { type: 'rematch' })
  await expect.poll(() => last(page, 'p2')).toMatchObject({ round: 2, turn: 1, yourColour: 1, wins: [1, 0], moves: 0 })
})

test('reconnecting with the same token gets the same seat and the live game; a stranger cannot take it', async ({ page }) => {
  await page.goto('/')
  const code = await newRoom(page)
  await connect(page, 'p1', code, 'token-for-player-one')
  await connect(page, 'p2', code, 'token-for-player-two')
  await send(page, 'p1', { type: 'move', col: 3 })
  await expect.poll(() => last(page, 'p2')).toMatchObject({ moves: 1 })

  await page.evaluate(() => (window as unknown as Record<string, { ws: WebSocket }>).p1.ws.close(1000))
  await expect.poll(() => last(page, 'p2')).toMatchObject({ connected: [false, true] })
  expect(await connect(page, 'stranger', code, 'a-different-token-123')).toEqual({ ok: false }) // seat 0 is held for its owner

  expect(await connect(page, 'p1b', code, 'token-for-player-one')).toEqual({ ok: true })
  await expect.poll(() => last(page, 'p1b')).toMatchObject({ you: 0, moves: 1, turn: 1, connected: [true, true] })

  // A second tab with the same token replaces the first.
  expect(await connect(page, 'p1c', code, 'token-for-player-one')).toEqual({ ok: true })
  await expect.poll(() => log(page, 'p1b')).toContainEqual({ closed: 4000 })
  await expect.poll(() => last(page, 'p1c')).toMatchObject({ you: 0 })
})

test('bad tokens, games and message sizes are refused', async ({ page }) => {
  await page.goto('/')
  const code = await newRoom(page)
  expect(await connect(page, 'short', code, 'short')).toEqual({ ok: false })
  expect(await connect(page, 'odd', code, 'x'.repeat(20), 'chess')).toEqual({ ok: false })

  await connect(page, 'big', code)
  await send(page, 'big', JSON.stringify({ pad: 'x'.repeat(3000) }))
  await expect.poll(() => log(page, 'big')).toContainEqual({ closed: 1009 })

  const code2 = await newRoom(page)
  await connect(page, 'bad', code2)
  await send(page, 'bad', 'not json')
  await expect.poll(() => log(page, 'bad')).toContainEqual({ closed: 1003 })
  const code3 = await newRoom(page)
  await connect(page, 'arr', code3)
  await send(page, 'arr', '[1,2,3]')
  await expect.poll(() => log(page, 'arr')).toContainEqual({ closed: 1003 })
})

test('a visitor who creates rooms too fast is slowed down, and someone else is not', async ({ request }) => {
  const make = (ip: string) => request.post('/api/rooms', { headers: { 'cf-connecting-ip': ip } })
  const results: number[] = []
  for (let i = 0; i < 12; i++) results.push((await make('203.0.113.7')).status())
  expect(results.slice(0, 10).every((s) => s === 201)).toBe(true)
  expect(results.slice(10)).toEqual([429, 429])
  expect((await request.post('/api/rooms', { headers: { 'cf-connecting-ip': '203.0.113.8' } })).status()).toBe(201)
})

test('a socket that floods messages gets told to slow down, and the game is unharmed', async ({ page }) => {
  await page.goto('/')
  const code = await newRoom(page)
  await connect(page, 'a', code)
  await connect(page, 'b', code)
  for (let i = 0; i < 30; i++) await send(page, 'a', { type: 'move', col: 99 })
  await expect.poll(async () => (await log(page, 'a')).filter((m) => m.code === 'slow-down').length).toBeGreaterThan(0)
  expect((await log(page, 'a')).some((m) => m.closed)).toBe(false)
})
