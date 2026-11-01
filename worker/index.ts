import { isRoomCode, makeRoomCode } from '../src/lib/roomcode'
import { createLimiter } from '../src/lib/ratelimit'
import { weekKey, isRankedGame } from '../src/lib/leaderboard'
import { sha256Hex } from './hash'
export { Room } from './room'
export { Leaderboard } from './leaderboard'

interface Env {
  ROOMS: DurableObjectNamespace
  LEADERBOARD: DurableObjectNamespace<import('./leaderboard').Leaderboard>
}

// Best effort: counters live in one Worker isolate's memory, so they slow abuse down rather than stop it outright.
const createLimit = createLimiter(10, 60_000) // new rooms per visitor per minute
const connectLimit = createLimiter(120, 60_000) // WebSocket connection attempts per visitor per minute (generous: reconnects and shared networks count)
// Cloudflare always sets this header; without it (local dev) there is nobody to count, so nothing is limited (the same goes for loopback).
const who = (request: Request) => {
  const ip = request.headers.get('cf-connecting-ip')
  return ip === '127.0.0.1' || ip === '::1' ? null : ip // local development and tests share one address
}

const viewLimit = createLimiter(60, 60_000) // leaderboard reads per visitor per minute
const forgetLimit = createLimiter(10, 60_000)
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

/**
 * Only `/api/*` reaches this Worker (see `run_worker_first` in wrangler.jsonc); every other request is served
 * straight from the static assets, so a Worker problem cannot take the arcade pages down.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const parts = url.pathname.split('/').filter(Boolean) // ['api', ...]

    if (url.pathname === '/api/health') return json({ ok: true, service: 'govibearcadia', protocol: 1 })

    if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
      const ip = who(request)
      if (ip && !viewLimit.hit(ip, Date.now())) return json({ error: 'slow-down' }, 429)
      const game = url.searchParams.get('game') ?? 'all'
      const period = url.searchParams.get('period') ?? 'week'
      if ((game !== 'all' && !isRankedGame(game)) || (period !== 'week' && period !== 'all')) return json({ error: 'bad-request' }, 400)
      const week = weekKey(new Date())
      const rows = await env.LEADERBOARD.get(env.LEADERBOARD.idFromName('global')).top(game, period, week)
      return new Response(JSON.stringify({ game, period, week, rows }), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' } })
    }

    // "Remove me from leaderboards": deletes every row stored for this player.
    if (url.pathname === '/api/leaderboard/me' && request.method === 'DELETE') {
      const ip = who(request)
      if (ip && !forgetLimit.hit(ip, Date.now())) return json({ error: 'slow-down' }, 429)
      const token = request.headers.get('x-player-token') ?? ''
      if (!TOKEN.test(token)) return json({ error: 'bad-token' }, 400)
      const removed = await env.LEADERBOARD.get(env.LEADERBOARD.idFromName('global')).forget(await sha256Hex(token))
      return json({ ok: true, removed }, 200)
    }

    if (url.pathname === '/api/leaderboard/status') {
      const stub = env.LEADERBOARD.get(env.LEADERBOARD.idFromName('global'))
      return json({ service: 'leaderboard', ...(await stub.status()) })
    }

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const ip = who(request)
      if (ip && !createLimit.hit(ip, Date.now())) return json({ error: 'slow-down' }, 429)
      return json({ code: makeRoomCode((bytes) => crypto.getRandomValues(bytes)) }, 201)
    }

    // /api/rooms/<CODE>/ws
    if (parts.length === 4 && parts[1] === 'rooms' && parts[3] === 'ws') {
      const code = parts[2]
      if (!isRoomCode(code)) return json({ error: 'bad-room-code' }, 400)
      const ip = who(request)
      if (ip && !connectLimit.hit(ip, Date.now())) return json({ error: 'slow-down' }, 429)
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request)
    }

    return json({ error: 'not-found' }, 404)
  },
}
