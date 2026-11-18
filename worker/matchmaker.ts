import { DurableObject } from 'cloudflare:workers'
import { makeRoomCode } from '../src/lib/roomcode'
import { emptyState, expire, join, leave, nextExpiry, WAIT_MS, type MatchState } from '../src/lib/matchmaking'
import { sha256Hex } from './hash'

/** A waiting player may send a few small messages (join, leave); anything bigger is a protocol error. */
const MAX_MESSAGE_BYTES = 512
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/

type Attachment = { player: string }
type Env = { MATCH_WAIT_MS?: string }

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/**
 * Quick-match queue for one game (docs/MATCHMAKING.md). It only introduces two players: when a second player
 * joins, both are sent the same room code and then use the normal `Room` for the game itself. The pairing rules
 * are the pure ones in `src/lib/matchmaking.ts`. The queue holds SHA-256 hashes of player tokens, never tokens,
 * and nothing is logged. Waiting sockets hibernate, so a waiting player costs no running time.
 */
export class Matchmaker extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // Keep-alive pings are answered without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
  }

  /** Test servers shorten the wait; production uses the 2-minute default. */
  private get waitMs(): number {
    const n = Number(this.env.MATCH_WAIT_MS)
    return Number.isFinite(n) && n >= 1000 ? n : WAIT_MS
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
    const token = new URL(request.url).searchParams.get('t') ?? ''
    if (!TOKEN.test(token)) return json({ error: 'bad-token' }, 400)
    const player = await sha256Hex(token)

    // A second connection from the same player (another tab) replaces the first.
    for (const old of this.ctx.getWebSockets()) if ((old.deserializeAttachment() as Attachment | null)?.player === player) old.close(4000, 'replaced')

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ player } satisfies Attachment)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return ws.close(1003, 'text only')
    if (new TextEncoder().encode(message).byteLength > MAX_MESSAGE_BYTES) return ws.close(1009, 'message too big')
    let type: unknown
    try {
      type = (JSON.parse(message) as { type?: unknown } | null)?.type
    } catch {
      return ws.close(1003, 'invalid json')
    }
    const player = (ws.deserializeAttachment() as Attachment | null)?.player
    if (!player) return ws.close(1008, 'no player')

    if (type === 'leave') {
      await this.save(leave(await this.load(), player))
      ws.close(1000, 'left')
      return void (await this.tellWaiting())
    }
    if (type !== 'join') return void ws.send(JSON.stringify({ type: 'error', code: 'unknown-message' }))

    const { state, result } = join(await this.load(), player, Date.now(), () => makeRoomCode((b) => crypto.getRandomValues(b)), this.waitMs)
    await this.save(state)
    if (result.kind === 'queue-full') {
      ws.send(JSON.stringify({ type: 'error', code: 'queue-full' }))
      return ws.close(1013, 'queue full')
    }
    if (result.kind === 'matched') {
      const note = JSON.stringify({ type: 'matched', code: result.code })
      ws.send(note)
      ws.close(1000, 'matched')
      if (result.partner) {
        for (const other of this.ctx.getWebSockets()) {
          if ((other.deserializeAttachment() as Attachment | null)?.player !== result.partner) continue
          other.send(note)
          other.close(1000, 'matched')
        }
      }
    }
    await this.tellWaiting()
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye')
    } catch {
      /* already closed */
    }
    // A player who closes while waiting leaves the queue, unless another of their sockets replaced this one.
    const player = (ws.deserializeAttachment() as Attachment | null)?.player
    if (!player) return
    const stillThere = this.ctx.getWebSockets().some((s) => s !== ws && (s.deserializeAttachment() as Attachment | null)?.player === player && s.readyState === WebSocket.READY_STATE_OPEN)
    if (stillThere) return
    await this.save(leave(await this.load(), player))
    await this.tellWaiting()
  }

  /** Entries that waited too long are dropped and their players told. */
  async alarm(): Promise<void> {
    const state = await this.load()
    const kept = expire(state, Date.now(), this.waitMs)
    const waiting = new Set(kept.waiting.map((w) => w.player))
    for (const ws of this.ctx.getWebSockets()) {
      const player = (ws.deserializeAttachment() as Attachment | null)?.player
      if (player && !waiting.has(player) && state.waiting.some((w) => w.player === player)) {
        ws.send(JSON.stringify({ type: 'timeout' }))
        ws.close(1000, 'timeout')
      }
    }
    await this.save(kept)
    await this.tellWaiting()
  }

  /** How many are waiting now. Called by the Worker for the lobby counts. */
  async status(): Promise<{ waiting: number }> {
    const state = expire(await this.load(), Date.now(), this.waitMs)
    return { waiting: state.waiting.length }
  }

  private async load(): Promise<MatchState> {
    return (await this.ctx.storage.get<MatchState>('mm')) ?? emptyState()
  }

  private async save(state: MatchState): Promise<void> {
    await this.ctx.storage.put('mm', state)
    const next = nextExpiry(state, this.waitMs)
    if (next === null) await this.ctx.storage.deleteAlarm()
    else await this.ctx.storage.setAlarm(next)
  }

  /** Tells every waiting player how many are in the queue. */
  private async tellWaiting(): Promise<void> {
    const state = await this.load()
    const waiting = new Set(state.waiting.map((w) => w.player))
    const note = JSON.stringify({ type: 'waiting', count: state.waiting.length })
    for (const ws of this.ctx.getWebSockets()) {
      const player = (ws.deserializeAttachment() as Attachment | null)?.player
      if (player && waiting.has(player) && ws.readyState === WebSocket.READY_STATE_OPEN) ws.send(note)
    }
  }
}
