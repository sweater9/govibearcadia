import { isRoomCode, makeRoomCode } from '../src/lib/roomcode'
import { createLimiter } from '../src/lib/ratelimit'
export { Room } from './room'

interface Env {
  ROOMS: DurableObjectNamespace
}

// Best effort: counters live in one Worker isolate's memory, so they slow abuse down rather than stop it outright.
const createLimit = createLimiter(10, 60_000) // new rooms per visitor per minute
const connectLimit = createLimiter(40, 60_000) // WebSocket connection attempts per visitor per minute
// Cloudflare always sets this header; without it (local dev) there is nobody to count, so nothing is limited.
const who = (request: Request) => request.headers.get('cf-connecting-ip')

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
