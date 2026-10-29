import { expect, test, type Page } from '@playwright/test'
import { isRoomCode } from '../src/lib/roomcode'

// Slice 3.0: the Worker and the Room Durable Object, exercised through the real Workers runtime.

const api = (page: Page, path: string, init?: { method?: string }) =>
  page.evaluate(async ([p, i]) => {
    const r = await fetch(p as string, i as RequestInit)
    return { status: r.status, type: r.headers.get('content-type'), body: await r.text() }
  }, [path, init ?? {}] as const)

/** Opens a socket in the page, collects every message, and exposes send/close via window. */
const connect = (page: Page, name: string, code: string) =>
  page.evaluate(
    ([n, c]) =>
      new Promise<{ ok: boolean }>((resolve) => {
        const w = window as unknown as Record<string, { ws: WebSocket; log: unknown[] }>
        const ws = new WebSocket(`${location.origin.replace('http', 'ws')}/api/rooms/${c}/ws`)
        const log: unknown[] = []
        w[n] = { ws, log }
        ws.onmessage = (e) => log.push(JSON.parse(e.data))
        ws.onclose = (e) => log.push({ closed: e.code })
        ws.onopen = () => resolve({ ok: true })
        ws.onerror = () => resolve({ ok: false })
      }),
    [name, code] as const,
  )
const log = (page: Page, name: string) => page.evaluate((n) => (window as unknown as Record<string, { log: unknown[] }>)[n].log, name)
const send = (page: Page, name: string, data: string) => page.evaluate(([n, d]) => (window as unknown as Record<string, { ws: WebSocket }>)[n].ws.send(d), [name, data] as const)

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

test('two players get seats, hear about each other, can echo, and a third is turned away', async ({ page }) => {
  await page.goto('/')
  const code = JSON.parse((await api(page, '/api/rooms', { method: 'POST' })).body).code
  expect(await connect(page, 'p1', code)).toEqual({ ok: true })
  await expect.poll(() => log(page, 'p1')).toEqual([{ type: 'hello', v: 1, seat: 0, players: 1 }])

  expect(await connect(page, 'p2', code)).toEqual({ ok: true })
  await expect.poll(() => log(page, 'p2')).toEqual([{ type: 'hello', v: 1, seat: 1, players: 2 }])
  await expect.poll(() => log(page, 'p1')).toContainEqual({ type: 'joined', seat: 1 })

  await send(page, 'p1', JSON.stringify({ hi: 'there' }))
  await expect.poll(() => log(page, 'p1')).toContainEqual({ type: 'echo', data: { hi: 'there' } })
  expect(await log(page, 'p2')).not.toContainEqual(expect.objectContaining({ type: 'echo' })) // not broadcast

  expect(await connect(page, 'p3', code)).toEqual({ ok: false }) // room is full (409)
})

test('a seat is freed when a player leaves, and the other player is told', async ({ page }) => {
  await page.goto('/')
  const code = JSON.parse((await api(page, '/api/rooms', { method: 'POST' })).body).code
  await connect(page, 'p1', code)
  await connect(page, 'p2', code)
  await page.evaluate(() => (window as unknown as Record<string, { ws: WebSocket }>).p1.ws.close(1000))
  await expect.poll(() => log(page, 'p2')).toContainEqual({ type: 'left', seat: 0 })
  expect(await connect(page, 'p3', code)).toEqual({ ok: true })
  await expect.poll(() => log(page, 'p3')).toEqual([{ type: 'hello', v: 1, seat: 0, players: 2 }])
})

test('oversized and malformed messages close the socket', async ({ page }) => {
  await page.goto('/')
  const code = JSON.parse((await api(page, '/api/rooms', { method: 'POST' })).body).code
  await connect(page, 'big', code)
  await send(page, 'big', JSON.stringify({ pad: 'x'.repeat(3000) }))
  await expect.poll(() => log(page, 'big')).toContainEqual({ closed: 1009 })

  const code2 = JSON.parse((await api(page, '/api/rooms', { method: 'POST' })).body).code
  await connect(page, 'bad', code2)
  await send(page, 'bad', 'not json')
  await expect.poll(() => log(page, 'bad')).toContainEqual({ closed: 1003 })
})
