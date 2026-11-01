/**
 * Pallanguzhi / Ali Guli Mane: pure rules (Karnataka ruleset). No React, no browser APIs, no randomness,
 * so the same state and the same actions always give the same result, and a server could reuse it.
 * Sources and the choices made where they disagree are in docs/PALLANGUZHI.md.
 *
 * Sections: board, configuration, state, sowing + capture, turns, rounds + refill, scoring, invariants.
 */

// ---------- board ----------

export const PITS = 14
export const PER_PLAYER = 7
export type Player = 0 | 1

/**
 * Pits are numbered 0 to 13 in the direction of play, which is fixed counterclockwise:
 * Player 1 (bottom row) owns 0 to 6, left to right; Player 2 (top row) owns 7 to 13, right to left.
 */
export const ownerOf = (pit: number): Player => (pit < PER_PLAYER ? 0 : 1)
export const opposite = (pit: number): number => PITS - 1 - pit
export const nextPit = (pit: number): number => (pit + 1) % PITS
export const rowOf = (player: Player): number[] => Array.from({ length: PER_PLAYER }, (_, i) => player * PER_PLAYER + i)
export const other = (p: Player): Player => (p === 0 ? 1 : 0)

// ---------- configuration (regional variants live here) ----------

export type Config = {
  /** 5 in Mysore and coastal Karnataka; 4 is the north Karnataka count, 6 the Tamil Nadu and Andhra count. */
  seedsPerPit: number
  /** Sowings allowed in one turn (the extra one is earned by a capture). Ali Guli Mane: 2. */
  maxSowings: number
  /** Does reaching a Saada whose capture pits are both empty still earn the second sowing? Default: no, it needs a real capture. */
  zeroCaptureGrantsSecond: boolean
  /**
   * What happens when the player to move has no seeds in their row.
   * 'owner-keeps': the round ends and the seeds left on the board go to the owner of the row they sit in.
   * 'pass': that player passes and the opponent keeps sowing.
   */
  stranded: 'owner-keeps' | 'pass'
  /** 'match': rounds continue until a player cannot refill one pit. 'single': one round, most captured seeds wins. */
  match: 'match' | 'single'
}

export const DEFAULT_CONFIG: Config = {
  seedsPerPit: 5,
  maxSowings: 2,
  zeroCaptureGrantsSecond: false,
  stranded: 'owner-keeps',
  match: 'match',
}

// ---------- state ----------

export type Phase = 'play' | 'round-over' | 'over'

export type GameEvent =
  | { type: 'sow'; player: Player; pit: number; seeds: number }
  | { type: 'relay'; player: Player; pit: number; seeds: number }
  | { type: 'saada'; player: Player; empty: number; captured: { pit: number; seeds: number }[]; total: number }
  | { type: 'second-sowing'; player: Player }
  | { type: 'pass'; player: Player }
  | { type: 'round-over'; round: number; stores: [number, number] }
  | { type: 'round-start'; round: number; first: Player; filled: [number, number] }
  | { type: 'match-over'; winner: Player | 'draw' }

export type State = {
  config: Config
  pits: number[]
  /** A pit that could not be refilled stays inactive (a "piggy" pit): it holds no seeds and sowing skips it. */
  active: boolean[]
  /** Captured seeds per player, including seeds kept back at a refill. */
  stores: [number, number]
  turn: Player
  /** Sowings used so far in the current turn. */
  sowings: number
  round: number
  firstPlayer: Player
  phase: Phase
  winner: Player | 'draw' | null
  /** The pit that last ended a sowing as a Saada, for highlighting. */
  lastEmpty: number | null
  /** What the last action did, oldest first. */
  events: GameEvent[]
}

export function newGame(config: Partial<Config> = {}): State {
  const c = { ...DEFAULT_CONFIG, ...config }
  return {
    config: c,
    pits: Array(PITS).fill(c.seedsPerPit),
    active: Array(PITS).fill(true),
    stores: [0, 0],
    turn: 0,
    sowings: 0,
    round: 1,
    firstPlayer: 0,
    phase: 'play',
    winner: null,
    lastEmpty: null,
    events: [],
  }
}

const copy = (s: State): State => ({ ...s, config: { ...s.config }, pits: [...s.pits], active: [...s.active], stores: [...s.stores] as [number, number], events: [] })

export const totalSeeds = (s: State): number => s.config.seedsPerPit * PITS
export const seedsOnBoard = (s: State): number => s.pits.reduce((a, b) => a + b, 0)
export const seedsInRow = (s: State, p: Player): number => rowOf(p).reduce((a, i) => a + s.pits[i], 0)

/** The next pit in the route after `pit`. Inactive (piggy) pits are not part of the route. */
export function routeNext(s: State, pit: number): number {
  let n = nextPit(pit)
  for (let i = 0; i < PITS && !s.active[n]; i++) n = nextPit(n)
  return n
}

// ---------- actions ----------

export type Action = { type: 'sow'; pit: number } | { type: 'next-round' }

/** One thing that happens on the board while a sowing is carried out, in order. The interface animates these. */
export type Step =
  | { t: 'pick'; pit: number; seeds: number; relay: boolean }
  | { t: 'drop'; pit: number }
  | { t: 'saada'; empty: number; captured: { pit: number; seeds: number }[] }

export type Result = { ok: true; state: State; trace: Step[] } | { ok: false; reason: string }

const fail = (reason: string): Result => ({ ok: false, reason })

/** Pits the player to move may choose: their own, active, and not empty. */
export function legalPits(s: State): number[] {
  if (s.phase !== 'play') return []
  return rowOf(s.turn).filter((i) => s.active[i] && s.pits[i] > 0)
}

/** Relay sowing can in theory circle for a very long time; a sowing that long simply stops without a capture. */
export const MAX_RELAYS = 2000

// ---------- sowing + capture ----------

function sow(s: State, pit: number, trace: Step[] | null): void {
  const me = s.turn
  let hand = s.pits[pit]
  s.pits[pit] = 0
  s.events.push({ type: 'sow', player: me, pit, seeds: hand })
  trace?.push({ t: 'pick', pit, seeds: hand, relay: false })
  let pos = pit
  s.lastEmpty = null
  for (let relays = 0; ; relays++) {
    while (hand > 0) {
      pos = routeNext(s, pos)
      s.pits[pos]++
      hand--
      trace?.push({ t: 'drop', pit: pos })
    }
    const n = routeNext(s, pos)
    if (s.pits[n] > 0) {
      if (relays >= MAX_RELAYS) {
        s.sowings++
        return
      }
      // Relay: the pit after the last seed has seeds, so lift them and keep sowing the same way.
      hand = s.pits[n]
      s.pits[n] = 0
      pos = n
      s.events.push({ type: 'relay', player: me, pit: n, seeds: hand })
      trace?.push({ t: 'pick', pit: n, seeds: hand, relay: true })
      continue
    }
    // Saada: the next pit is empty. Skip it, then take the pit beyond it and the pit opposite that one.
    const beyond = routeNext(s, n)
    const captured: { pit: number; seeds: number }[] = []
    for (const p of [beyond, opposite(beyond)]) {
      if (s.pits[p] > 0 && !captured.some((c) => c.pit === p)) {
        captured.push({ pit: p, seeds: s.pits[p] })
        s.pits[p] = 0
      }
    }
    const total = captured.reduce((a, c) => a + c.seeds, 0)
    s.stores[me] += total
    s.lastEmpty = n
    s.events.push({ type: 'saada', player: me, empty: n, captured, total })
    trace?.push({ t: 'saada', empty: n, captured })
    s.sowings++
    return
  }
}

// ---------- turns ----------

/** Did the sowing that just finished earn another one? */
function earnedSecond(s: State): boolean {
  const last = [...s.events].reverse().find((e) => e.type === 'saada')
  if (!last || last.type !== 'saada') return false
  return last.total > 0 || s.config.zeroCaptureGrantsSecond
}

function endTurn(s: State): void {
  if (seedsOnBoard(s) === 0) return endRound(s)
  const me = s.turn
  const second = s.sowings < s.config.maxSowings && earnedSecond(s) && seedsInRow(s, me) > 0
  if (second) {
    s.events.push({ type: 'second-sowing', player: me })
    return
  }
  s.turn = other(me)
  s.sowings = 0
  if (seedsInRow(s, s.turn) === 0) {
    if (s.config.stranded === 'owner-keeps') return endRound(s)
    s.events.push({ type: 'pass', player: s.turn })
    s.turn = other(s.turn)
  }
}

// ---------- rounds + refill + scoring ----------

/** Pits a store can fill: five seeds each (the configured count), never more than the seven the player has. */
export const fillable = (store: number, c: Config): number => Math.min(PER_PLAYER, Math.floor(store / c.seedsPerPit))

function endRound(s: State): void {
  // Seeds still on the board belong to the owner of the row they sit in.
  for (let i = 0; i < PITS; i++) {
    s.stores[ownerOf(i)] += s.pits[i]
    s.pits[i] = 0
  }
  s.events.push({ type: 'round-over', round: s.round, stores: [...s.stores] as [number, number] })
  s.sowings = 0
  const [a, b] = [fillable(s.stores[0], s.config), fillable(s.stores[1], s.config)]
  const byStores = (): Player | 'draw' => (s.stores[0] === s.stores[1] ? 'draw' : s.stores[0] > s.stores[1] ? 0 : 1)
  if (s.config.match === 'single') return finish(s, byStores())
  if (a === 0 && b === 0) return finish(s, byStores())
  if (a === 0) return finish(s, 1)
  if (b === 0) return finish(s, 0)
  s.phase = 'round-over'
}

function finish(s: State, winner: Player | 'draw'): void {
  s.phase = 'over'
  s.winner = winner
  s.events.push({ type: 'match-over', winner })
}

/**
 * Refill for the next round. Each player fills as many of their pits as their captured seeds allow, five seeds each;
 * seeds that cannot fill another pit stay in the store. Pits that stay empty become inactive. Pits that were active
 * are kept first, then previously inactive pits are brought back (lowest first) if the player can now afford them.
 */
function refill(s: State): void {
  const filled: [number, number] = [0, 0]
  for (const p of [0, 1] as const) {
    const k = fillable(s.stores[p], s.config)
    const row = rowOf(p)
    const order = [...row.filter((i) => s.active[i]), ...row.filter((i) => !s.active[i])]
    const chosen = new Set(order.slice(0, k))
    for (const i of row) {
      s.active[i] = chosen.has(i)
      s.pits[i] = chosen.has(i) ? s.config.seedsPerPit : 0
    }
    s.stores[p] -= k * s.config.seedsPerPit
    filled[p] = k
  }
  s.round++
  s.firstPlayer = other(s.firstPlayer)
  s.turn = s.firstPlayer
  s.sowings = 0
  s.phase = 'play'
  s.lastEmpty = null
  s.events.push({ type: 'round-start', round: s.round, first: s.firstPlayer, filled })
}

// ---------- apply ----------

export function apply(prev: State, action: Action, record = true): Result {
  const s = copy(prev)
  if (action.type === 'next-round') {
    if (prev.phase !== 'round-over') return fail('not-between-rounds')
    refill(s)
    return { ok: true, state: s, trace: [] }
  }
  if (prev.phase === 'over') return fail('game-over')
  if (prev.phase !== 'play') return fail('round-over')
  const pit = action.pit
  if (!Number.isInteger(pit) || pit < 0 || pit >= PITS) return fail('no-such-pit')
  if (ownerOf(pit) !== prev.turn) return fail('not-your-pit')
  if (!prev.active[pit]) return fail('inactive-pit')
  if (prev.pits[pit] === 0) return fail('empty-pit')
  if (prev.sowings >= prev.config.maxSowings) return fail('no-sowings-left')
  const trace: Step[] | null = record ? [] : null
  sow(s, pit, trace)
  endTurn(s)
  return { ok: true, state: s, trace: trace ?? [] }
}

/** Replays a recorded action list from a fresh game: the same actions always give the same state. */
export function replay(actions: Action[], config: Partial<Config> = {}): State {
  let s = newGame(config)
  for (const a of actions) {
    const r = apply(s, a, false)
    if (!r.ok) throw new Error(`illegal action ${JSON.stringify(a)}: ${r.reason}`)
    s = r.state
  }
  return s
}

// ---------- invariants ----------

/** Empty when the state is sound: seeds are conserved, nothing is negative, inactive pits are empty, between rounds the board is empty. */
export function invariantErrors(s: State): string[] {
  const errors: string[] = []
  const total = seedsOnBoard(s) + s.stores[0] + s.stores[1]
  if (total !== totalSeeds(s)) errors.push(`seed total ${total} is not ${totalSeeds(s)}`)
  if (s.pits.length !== PITS || s.active.length !== PITS) errors.push('wrong number of pits')
  s.pits.forEach((n, i) => {
    if (!Number.isInteger(n) || n < 0) errors.push(`pit ${i} holds ${n}`)
    if (!s.active[i] && n !== 0) errors.push(`inactive pit ${i} holds seeds`)
  })
  if (s.stores.some((n) => !Number.isInteger(n) || n < 0)) errors.push('negative store')
  if (s.phase !== 'play' && seedsOnBoard(s) !== 0) errors.push('seeds on the board between rounds')
  for (const p of [0, 1] as const) if (!rowOf(p).some((i) => s.active[i]) && s.phase === 'play') errors.push(`player ${p} has no active pit`)
  return errors
}
