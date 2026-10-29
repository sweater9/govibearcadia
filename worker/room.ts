import { DurableObject } from 'cloudflare:workers'
import { applyMove, newRoom, parseRoom, requestRematch, viewFor, type Room as RoomState, type Seat } from '../src/games/connect4/online'

/** Largest message a client may send. Anything bigger closes the socket (protocol error). */
export const MAX_MESSAGE_BYTES = 2048
/** A room is deleted after this long without any activity. */
const IDLE_MS = 2 * 60 * 60 * 1000
const GAMES = ['connect-four'] as const
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/

type Attachment = { seat: Seat }
type Seats = [string | null, string | null]

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/**
 * One room. Seats belong to anonymous player tokens, so a player who drops or reloads gets the same seat back.
 * The room state lives in Durable Object storage (so it survives hibernation) and every move is validated by the
 * same pure rules the client uses. Clients send intentions; the server decides.
 */
export class Room extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
    const url = new URL(request.url)
    const token = url.searchParams.get('t') ?? ''
    const game = url.searchParams.get('g') ?? ''
    if (!TOKEN.test(token)) return json({ error: 'bad-token' }, 400)
    if (!(GAMES as readonly string[]).includes(game)) return json({ error: 'bad-game' }, 400)

    const storedGame = await this.ctx.storage.get<string>('game')
    if (storedGame && storedGame !== game) return json({ error: 'wrong-game' }, 409)
    const seats = (await this.ctx.storage.get<Seats>('seats')) ?? [null, null]
    let seat: Seat | undefined = ([0, 1] as const).find((s) => seats[s] === token)
    if (seat === undefined) seat = ([0, 1] as const).find((s) => seats[s] === null)
    if (seat === undefined) return json({ error: 'room-full' }, 409)

    if (!storedGame) await this.ctx.storage.put({ game, seats, room: newRoom() })
    if (seats[seat] !== token) {
      seats[seat] = token
      await this.ctx.storage.put('seats', seats)
    }

    // A second connection from the same player (reload, second tab) replaces the first.
    for (const old of this.ctx.getWebSockets()) if ((old.deserializeAttachment() as Attachment | null)?.seat === seat) old.close(4000, 'replaced')

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ seat } satisfies Attachment)
    await this.touch()
    await this.broadcast()
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const size = typeof message === 'string' ? new TextEncoder().encode(message).byteLength : message.byteLength
    if (size > MAX_MESSAGE_BYTES) return ws.close(1009, 'message too big')
    if (typeof message !== 'string') return ws.close(1003, 'text only')
    let data: { type?: unknown; col?: unknown }
    try {
      const parsed: unknown = JSON.parse(message)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object')
      data = parsed
    } catch {
      return ws.close(1003, 'invalid json')
    }
    const seat = (ws.deserializeAttachment() as Attachment | null)?.seat
    if (seat === undefined) return ws.close(1008, 'no seat')
    const room = parseRoom(await this.ctx.storage.get('room'))
    if (!room) return ws.close(1011, 'room state lost')

    let outcome
    if (data.type === 'move') outcome = applyMove(room, seat, data.col)
    else if (data.type === 'rematch') outcome = requestRematch(room, seat)
    else return void ws.send(JSON.stringify({ type: 'error', code: 'unknown-message' }))

    if (!outcome.ok) return void ws.send(JSON.stringify({ type: 'error', code: outcome.error }))
    await this.ctx.storage.put('room', outcome.room)
    await this.touch()
    await this.broadcast(outcome.room)
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye')
    } catch {
      /* already closed */
    }
    await this.broadcast()
  }

  /** Idle rooms delete themselves, which frees the code and the storage. */
  async alarm(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'room expired')
    await this.ctx.storage.deleteAll()
  }

  private touch(): Promise<void> {
    return this.ctx.storage.setAlarm(Date.now() + IDLE_MS)
  }

  /** Sends every connected player their own view, plus who is currently connected. */
  private async broadcast(known?: RoomState): Promise<void> {
    const room = known ?? parseRoom(await this.ctx.storage.get('room'))
    if (!room) return
    const sockets = this.ctx.getWebSockets()
    const connected: [boolean, boolean] = [false, false]
    for (const ws of sockets) {
      const seat = (ws.deserializeAttachment() as Attachment | null)?.seat
      if (seat !== undefined && ws.readyState === WebSocket.READY_STATE_OPEN) connected[seat] = true
    }
    for (const ws of sockets) {
      const seat = (ws.deserializeAttachment() as Attachment | null)?.seat
      if (seat === undefined || ws.readyState !== WebSocket.READY_STATE_OPEN) continue
      ws.send(JSON.stringify({ type: 'state', v: 1, game: 'connect-four', connected, ...viewFor(room, seat) }))
    }
  }
}
