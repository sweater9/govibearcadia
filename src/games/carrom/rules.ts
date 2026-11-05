/**
 * Carrom: pure rules. No React, no Phaser, no browser APIs. The physics (Phaser's Matter engine) only reports what a shot did,
 * as a `ShotOutcome`; everything else (whose turn, queen cover, fouls, scoring, boards, the match) is decided here, so it is
 * testable and deterministic. Sources and the choices made where they differ are in docs/CARROM.md.
 */

// ---------- geometry (board units are millimetres of a 74 cm playing surface) ----------

export const BOARD = 740
export const CENTRE = BOARD / 2
export const COIN_R = 15.5
export const STRIKER_R = 20.5
export const POCKET_R = 24
export const POCKET_INSET = 17
export const POCKETS: readonly [number, number][] = [
  [POCKET_INSET, POCKET_INSET], [BOARD - POCKET_INSET, POCKET_INSET],
  [BOARD - POCKET_INSET, BOARD - POCKET_INSET], [POCKET_INSET, BOARD - POCKET_INSET],
]

export type Player = 0 | 1 | 2 | 3
/** White plays seats 0 and 2, black seats 1 and 3. Partners sit opposite each other and turns go clockwise. */
export type Side = 0 | 1
export const sideOf = (seat: number): Side => (seat % 2) as Side
export type CoinKind = 'white' | 'black' | 'queen'
export const kindOfSide = (s: Side): 'white' | 'black' => (s === 0 ? 'white' : 'black')

/** The baseline each seat shoots from: the striker slides along it. Seat 0 bottom, 1 right, 2 top, 3 left (clockwise). */
export const BASE_OFFSET = 105
export const BASE_HALF = 270 // the striker's centre may be this far either side of the middle
export function baseline(seat: number): { x: number; y: number; dx: number; dy: number; fx: number; fy: number } {
  switch (seat % 4) {
    case 0: return { x: CENTRE, y: BOARD - BASE_OFFSET, dx: 1, dy: 0, fx: 0, fy: -1 }
    case 1: return { x: BOARD - BASE_OFFSET, y: CENTRE, dx: 0, dy: -1, fx: -1, fy: 0 }
    case 2: return { x: CENTRE, y: BASE_OFFSET, dx: -1, dy: 0, fx: 0, fy: 1 }
    default: return { x: BASE_OFFSET, y: CENTRE, dx: 0, dy: 1, fx: 1, fy: 0 }
  }
}
/** The striker's position for a seat, with `t` from -1 to 1 along the baseline. */
export function strikerAt(seat: number, t: number): { x: number; y: number } {
  const b = baseline(seat)
  const k = Math.max(-1, Math.min(1, t)) * BASE_HALF
  return { x: b.x + b.dx * k, y: b.y + b.dy * k }
}

export type Coin = { id: number; kind: CoinKind; x: number; y: number; pocketed: boolean }

/** The standard layout: the queen in the middle, six coins touching her, twelve touching those, colours alternating. */
export function startingCoins(): Coin[] {
  const d = COIN_R * 2
  const coins: Coin[] = [{ id: 0, kind: 'queen', x: CENTRE, y: CENTRE, pocketed: false }]
  const ring = (n: number, radius: number, angle0: number, colour: (i: number) => 'white' | 'black') => {
    for (let i = 0; i < n; i++) {
      const a = angle0 + (i * 2 * Math.PI) / n
      coins.push({ id: coins.length, kind: colour(i), x: CENTRE + Math.cos(a) * radius, y: CENTRE + Math.sin(a) * radius, pocketed: false })
    }
  }
  const start = -Math.PI / 2 // one line of queen, inner coin, outer coin points at the first player's far side
  ring(6, d, start, (i) => (i % 2 === 0 ? 'white' : 'black'))
  for (let j = 0; j < 12; j++) {
    const a = start + (j * Math.PI) / 6
    const r = j % 2 === 0 ? 2 * d : 2 * d * Math.cos(Math.PI / 6)
    coins.push({ id: coins.length, kind: j % 4 < 2 ? 'white' : 'black', x: CENTRE + Math.cos(a) * r, y: CENTRE + Math.sin(a) * r, pocketed: false })
  }
  return coins
}

// ---------- configuration ----------

export type Config = {
  players: 2 | 4
  /** The match ends when a side reaches this many points... */
  target: number
  /** ...or after this many boards. */
  maxBoards: number
  queenPoints: number
  /** The queen's points are not scored once the winner already has this many (22 in a 25-point game). */
  queenCutoff: number
  /** A foul returns the coin: 'stays' keeps an opponent coin that was pocketed by accident down; 'returns' puts it back. */
  opponentCoin: 'stays' | 'returns'
}
export const DEFAULT_CONFIG: Config = { players: 2, target: 25, maxBoards: 8, queenPoints: 3, queenCutoff: 22, opponentCoin: 'stays' }

// ---------- state ----------

export type Event =
  | { type: 'pocket'; seat: number; id: number; kind: CoinKind }
  | { type: 'foul'; seat: number; reason: 'striker' | 'opponent-coin' | 'last-coin-before-queen' | 'opponent-last-coin' }
  | { type: 'queen-covered'; seat: number }
  | { type: 'queen-pending'; seat: number }
  | { type: 'queen-returned'; seat: number }
  | { type: 'coin-returned'; seat: number; id: number }
  | { type: 'penalty-owed'; seat: number }
  | { type: 'again'; seat: number }
  | { type: 'pass'; from: number; to: number }
  | { type: 'board-won'; side: Side; points: number }
  | { type: 'match-over'; winner: Side | 'draw' }

export type QueenState = 'board' | 'pending' | 'covered'

export type State = {
  config: Config
  coins: Coin[]
  /** The seat that shoots next. */
  turn: number
  /** The seat that shot first on this board. */
  breaker: number
  queen: QueenState
  /** The side that covered the queen. */
  queenSide: Side | null
  /** Penalty coins a side owes (it had nothing pocketed to give back). */
  owed: [number, number]
  scores: [number, number]
  board: number
  phase: 'aim' | 'board-over' | 'over'
  winner: Side | 'draw' | null
  lastBoard: { winner: Side; points: number } | null
  events: Event[]
}

export function newMatch(config: Partial<Config> = {}): State {
  const c = { ...DEFAULT_CONFIG, ...config }
  return { config: c, coins: startingCoins(), turn: 0, breaker: 0, queen: 'board', queenSide: null, owed: [0, 0], scores: [0, 0], board: 1, phase: 'aim', winner: null, lastBoard: null, events: [] }
}

const copy = (s: State): State => ({ ...s, config: { ...s.config }, coins: s.coins.map((c) => ({ ...c })), owed: [...s.owed] as [number, number], scores: [...s.scores] as [number, number], events: [] })

export const onBoard = (s: State) => s.coins.filter((c) => !c.pocketed)
export const ownCoins = (s: State, side: Side) => s.coins.filter((c) => c.kind === kindOfSide(side))
export const remaining = (s: State, side: Side) => ownCoins(s, side).filter((c) => !c.pocketed).length
export const nextSeat = (s: State, seat: number) => (seat + 1) % s.config.players

// ---------- the outcome of one shot, as reported by the physics ----------

export type ShotOutcome = {
  /** Ids of the coins that went into a pocket. */
  pocketed: number[]
  strikerPocketed: boolean
  /** Where every coin that stayed on the board came to rest. */
  positions: Record<number, { x: number; y: number }>
}

/** A free spot for a coin put back on the board: the centre, or the nearest place around it clear of every other coin. */
export function freeSpotNearCentre(coins: Coin[], ignoreId: number): { x: number; y: number } {
  const others = coins.filter((c) => !c.pocketed && c.id !== ignoreId)
  const clear = (x: number, y: number) => others.every((o) => Math.hypot(o.x - x, o.y - y) >= COIN_R * 2 - 0.01)
  if (clear(CENTRE, CENTRE)) return { x: CENTRE, y: CENTRE }
  for (let r = COIN_R; r < BOARD / 2 - 60; r += COIN_R / 2) {
    const steps = Math.max(8, Math.round((2 * Math.PI * r) / COIN_R))
    for (let i = 0; i < steps; i++) {
      const a = (i * 2 * Math.PI) / steps
      const x = CENTRE + Math.cos(a) * r
      const y = CENTRE + Math.sin(a) * r
      if (clear(x, y)) return { x, y }
    }
  }
  return { x: CENTRE, y: CENTRE }
}

function putBack(s: State, id: number, seat: number) {
  const coin = s.coins.find((c) => c.id === id)!
  const p = freeSpotNearCentre(s.coins, id)
  coin.x = p.x
  coin.y = p.y
  coin.pocketed = false
  s.events.push({ type: 'coin-returned', seat, id })
}

/** The penalty: one of the side's own pocketed coins goes back to the centre, or it is owed until it has one. */
function penalty(s: State, side: Side, seat: number, exceptIds: number[] = []) {
  const own = ownCoins(s, side).find((c) => c.pocketed && !exceptIds.includes(c.id))
  if (own) putBack(s, own.id, seat)
  else {
    s.owed[side]++
    s.events.push({ type: 'penalty-owed', seat })
  }
}

// ---------- resolving a shot ----------

export function resolveShot(prev: State, shot: ShotOutcome): State {
  if (prev.phase !== 'aim') return prev
  const s = copy(prev)
  const seat = s.turn
  const side = sideOf(seat)
  const own = kindOfSide(side)

  // Coins come to rest where the physics left them.
  for (const c of s.coins) {
    const p = shot.positions[c.id]
    if (!c.pocketed && p) {
      c.x = p.x
      c.y = p.y
    }
  }
  const down = s.coins.filter((c) => shot.pocketed.includes(c.id) && !c.pocketed)
  for (const c of down) {
    c.pocketed = true
    s.events.push({ type: 'pocket', seat, id: c.id, kind: c.kind })
  }
  const ownDown = down.filter((c) => c.kind === own)
  const oppDown = down.filter((c) => c.kind !== own && c.kind !== 'queen')
  const queenDown = down.find((c) => c.kind === 'queen')
  const queenId = s.coins[0].id

  let foul = false
  let keepTurn = false

  if (shot.strikerPocketed) {
    // The striker in a pocket: every coin pocketed in the shot comes back, and a penalty coin as well.
    foul = true
    s.events.push({ type: 'foul', seat, reason: 'striker' })
    for (const c of down) putBack(s, c.id, seat)
    if (s.queen === 'pending') {
      s.queen = 'board'
      s.events.push({ type: 'queen-returned', seat })
    }
    penalty(s, side, seat, down.map((c) => c.id))
  } else {
    // A coin the side owed comes back out of this shot's pocketing, as a penalty paid.
    let paid = 0
    while (s.owed[side] > paid && ownDown.length > paid) {
      putBack(s, ownDown[paid].id, seat)
      paid++
    }
    s.owed[side] -= paid
    const scored = ownDown.slice(paid)

    if (oppDown.length) {
      s.events.push({ type: 'foul', seat, reason: 'opponent-coin' })
      if (s.config.opponentCoin === 'returns') for (const c of oppDown) putBack(s, c.id, seat)
      foul = true // the turn is lost; coins of the shooter's own colour pocketed in the same shot still count
    }

    // The opponent's last coin: it goes back, with a penalty coin from the shooter.
    const oppSide = (1 - side) as Side
    if (oppDown.length && s.config.opponentCoin === 'stays' && remaining(s, oppSide) === 0) {
      s.events.push({ type: 'foul', seat, reason: 'opponent-last-coin' })
      putBack(s, oppDown[0].id, seat)
      penalty(s, side, seat, [])
    }

    // The queen.
    if (queenDown) {
      if (foul) {
        putBack(s, queenId, seat)
        s.events.push({ type: 'queen-returned', seat })
      } else if (scored.length > 0) {
        s.queen = 'covered'
        s.queenSide = side
        s.events.push({ type: 'queen-covered', seat })
        keepTurn = true
      } else {
        s.queen = 'pending'
        s.events.push({ type: 'queen-pending', seat })
        keepTurn = true
      }
    } else if (s.queen === 'pending') {
      // This shot was the cover attempt.
      if (scored.length > 0 && !foul) {
        s.queen = 'covered'
        s.queenSide = side
        s.events.push({ type: 'queen-covered', seat })
      } else {
        putBack(s, queenId, seat)
        s.queen = 'board'
        s.events.push({ type: 'queen-returned', seat })
      }
    }

    // The side's last coin cannot go down before the queen is covered.
    if (!foul && remaining(s, side) === 0 && s.queen !== 'covered' && scored.length > 0) {
      s.events.push({ type: 'foul', seat, reason: 'last-coin-before-queen' })
      putBack(s, scored[scored.length - 1].id, seat)
      penalty(s, side, seat, [scored[scored.length - 1].id])
      foul = true
      if (s.queen === 'pending') {
        putBack(s, queenId, seat)
        s.queen = 'board'
        s.events.push({ type: 'queen-returned', seat })
      }
    }

    if (!foul && scored.length > 0) keepTurn = true
  }

  // A board is won by clearing all your coins once the queen is covered.
  for (const sd of [side, (1 - side) as Side]) {
    if (s.queen === 'covered' && remaining(s, sd) === 0) return endBoard(s, sd)
  }

  if (keepTurn && !foul && shot.pocketed.length >= 0) {
    s.events.push({ type: 'again', seat })
  } else {
    const to = nextSeat(s, seat)
    s.events.push({ type: 'pass', from: seat, to })
    s.turn = to
  }
  return s
}

function endBoard(s: State, winner: Side): State {
  const loser = (1 - winner) as Side
  let points = remaining(s, loser)
  if (s.queenSide === winner && s.scores[winner] < s.config.queenCutoff) points += s.config.queenPoints
  s.scores[winner] += points
  s.lastBoard = { winner, points }
  s.events.push({ type: 'board-won', side: winner, points })
  const done = s.scores[0] >= s.config.target || s.scores[1] >= s.config.target || s.board >= s.config.maxBoards
  if (done) {
    s.phase = 'over'
    s.winner = s.scores[0] === s.scores[1] ? 'draw' : s.scores[0] > s.scores[1] ? 0 : 1
    s.events.push({ type: 'match-over', winner: s.winner })
  } else s.phase = 'board-over'
  return s
}

/** After a board, set the coins up again. The next board's first shot goes to the next seat. */
export function nextBoard(prev: State): State {
  if (prev.phase !== 'board-over') return prev
  const s = copy(prev)
  s.coins = startingCoins()
  s.board++
  s.breaker = nextSeat(s, prev.breaker)
  s.turn = s.breaker
  s.queen = 'board'
  s.queenSide = null
  s.owed = [0, 0]
  s.phase = 'aim'
  return s
}

// ---------- invariants ----------

export function invariantErrors(s: State): string[] {
  const errors: string[] = []
  if (s.coins.length !== 19) errors.push(`${s.coins.length} coins`)
  if (s.coins.filter((c) => c.kind === 'white').length !== 9 || s.coins.filter((c) => c.kind === 'black').length !== 9) errors.push('not nine of each colour')
  const live = onBoard(s)
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++) if (Math.hypot(live[i].x - live[j].x, live[i].y - live[j].y) < COIN_R * 2 - 0.5) errors.push(`coins ${live[i].id} and ${live[j].id} overlap`)
  if (s.queen === 'board' && s.coins[0].pocketed) errors.push('queen pocketed but marked on the board')
  if (s.owed.some((n) => n < 0)) errors.push('negative penalty')
  return errors
}

// ---------- aiming (shared by the board, the computer and the tests) ----------

export type Aim = { /** -1..1 along the baseline */ t: number; /** radians away from straight ahead */ angle: number; /** 0..1 */ power: number }
export const MAX_ANGLE = (70 * Math.PI) / 180
export const DEFAULT_AIM: Aim = { t: 0, angle: 0, power: 0.55 }

/** The unit direction of a shot for a seat, `angle` radians from straight ahead (positive turns clockwise on screen). */
export function aimDir(seat: number, angle: number): { x: number; y: number } {
  const { fx, fy } = baseline(seat)
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: fx * c - fy * s, y: fx * s + fy * c }
}
/** The angle (clamped) that points from the striker along (dx, dy). */
export function angleFor(seat: number, dx: number, dy: number): number {
  const { fx, fy } = baseline(seat)
  const a = Math.atan2(fx * dy - fy * dx, fx * dx + fy * dy)
  return Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, a))
}
/** True when a coin sits where the striker would be placed. */
export function strikerBlocked(coins: Coin[], seat: number, t: number): boolean {
  const p = strikerAt(seat, t)
  return coins.some((c) => !c.pocketed && Math.hypot(c.x - p.x, c.y - p.y) < COIN_R + STRIKER_R - 0.01)
}
