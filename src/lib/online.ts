/** Browser side of online play: the anonymous player token and the WebSocket address. */

const KEY = 'govibearcadia.player'
let memoryToken: string | null = null

/** A random anonymous id kept on this device. It only lets you get your seat back; it identifies nobody. */
export function playerToken(): string {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved && /^[A-Za-z0-9_-]{16,64}$/.test(saved)) return saved
  } catch {
    /* storage blocked: fall back to memory for this tab */
  }
  if (!memoryToken) {
    const bytes = crypto.getRandomValues(new Uint8Array(24))
    memoryToken = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  try {
    localStorage.setItem(KEY, memoryToken)
  } catch {
    /* ignore */
  }
  return memoryToken
}

export const roomSocketUrl = (code: string, game: string, origin: string = location.origin): string =>
  `${origin.replace(/^http/, 'ws')}/api/rooms/${code}/ws?g=${encodeURIComponent(game)}&t=${playerToken()}`

export async function createRoom(): Promise<string | null> {
  try {
    const r = await fetch('/api/rooms', { method: 'POST' })
    if (!r.ok) return null
    const body: unknown = await r.json()
    return typeof body === 'object' && body !== null && typeof (body as { code?: unknown }).code === 'string' ? (body as { code: string }).code : null
  } catch {
    return null
  }
}

/** Games that can be played in an online room. The Worker's own list (src/games/onlineGames.ts) must match. */
export const ONLINE_GAME_LIST = [
  { id: 'connect-four', title: 'Connect Four' },
  { id: 'tic-tac-toe', title: 'Tic-Tac-Toe' },
  { id: 'checkers', title: 'Checkers' },
  { id: 'battleship', title: 'Battleship' },
] as const
export type OnlineGameId = (typeof ONLINE_GAME_LIST)[number]['id']

/** The game named by a `?g=` link, falling back to Connect Four (the only game early links ever named). */
export const gameFromParam = (value: string | null): OnlineGameId => ONLINE_GAME_LIST.find((g) => g.id === value)?.id ?? 'connect-four'
