import { DurableObject } from 'cloudflare:workers'

/** Largest message a client may send. Anything bigger closes the socket (protocol error). */
export const MAX_MESSAGE_BYTES = 2048
/** A room seats two players. */
export const MAX_SEATS = 2

type Seat = { seat: number }

/**
 * One room. Slice 3.0 only proves the plumbing: it accepts hibernatable WebSockets, limits seats and message size,
 * tells each client who it is, and echoes. Game logic arrives in slice 3.1.
 */
export class Room extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })

    const taken = new Set(this.ctx.getWebSockets().map((ws) => (ws.deserializeAttachment() as Seat | null)?.seat))
    const seat = [0, 1].find((s) => !taken.has(s))
    if (seat === undefined) return new Response(JSON.stringify({ error: 'room-full' }), { status: 409, headers: { 'content-type': 'application/json' } })

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ seat } satisfies Seat)
    server.send(JSON.stringify({ type: 'hello', v: 1, seat, players: this.ctx.getWebSockets().length }))
    for (const other of this.ctx.getWebSockets()) if (other !== server) other.send(JSON.stringify({ type: 'joined', seat }))
    return new Response(null, { status: 101, webSocket: client })
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const size = typeof message === 'string' ? new TextEncoder().encode(message).byteLength : message.byteLength
    if (size > MAX_MESSAGE_BYTES) return ws.close(1009, 'message too big')
    if (typeof message !== 'string') return ws.close(1003, 'text only')
    let data: unknown
    try {
      data = JSON.parse(message)
    } catch {
      return ws.close(1003, 'invalid json')
    }
    ws.send(JSON.stringify({ type: 'echo', data }))
  }

  webSocketClose(ws: WebSocket, code: number): void {
    const seat = (ws.deserializeAttachment() as Seat | null)?.seat
    for (const other of this.ctx.getWebSockets()) if (other !== ws) other.send(JSON.stringify({ type: 'left', seat }))
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye')
    } catch {
      /* already closed */
    }
  }
}
