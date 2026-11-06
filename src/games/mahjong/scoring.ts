import { WIND_BASE, isDragon, isHonour, isSuited, isWind, seatFlowers, splits, suitOf } from './tiles'

export type Meld = { kind: 'chow' | 'pung' | 'kong'; /** The pung or kong tile, or the lowest tile of a chow. */ tile: number; open: boolean }
export type WinContext = {
  /** Tile counts of the concealed hand, including the winning tile. */
  concealed: readonly number[]
  melds: readonly Meld[]
  flowers: readonly number[]
  selfDraw: boolean
  winTile: number
  afterKong: boolean
  /** 0 East, 1 South, 2 West, 3 North. */
  seatWind: number
  roundWind: number
  /** 'all' scores every wind pung 1 tai; default is seat and round wind only. */
  windPungs?: 'seat-round' | 'all'
}
export type Item = { name: string; tai: number }
export type Score = { tai: number; items: Item[] }

type Group = { kind: 'chow' | 'pung'; tile: number; open: boolean }

/** The tai of a winning hand, the best of every way the tiles can be split, or null if it is not a complete hand. */
export function scoreWin(ctx: WinContext): Score | null {
  const options = splits(ctx.concealed, 5 - ctx.melds.length)
  let best: Score | null = null
  for (const sp of options) {
    const groups: Group[] = [
      ...ctx.melds.map((m): Group => ({ kind: m.kind === 'chow' ? 'chow' : 'pung', tile: m.tile, open: m.open })),
      // A pung that the winning discard completed was claimed, so it is not concealed.
      ...sp.sets.map((s): Group => ({ kind: s.kind, tile: s.tile, open: !ctx.selfDraw && s.kind === 'pung' && s.tile === ctx.winTile })),
    ]
    const sc = scoreSplit(ctx, groups, sp.pair)
    if (!best || sc.tai > best.tai) best = sc
  }
  return best
}

function scoreSplit(ctx: WinContext, groups: Group[], pair: number): Score {
  const items: Item[] = []
  const add = (name: string, tai: number) => items.push({ name, tai })
  const closedHand = ctx.melds.every((m) => !m.open)

  if (ctx.selfDraw && closedHand) add('Concealed self-draw', 3)
  else if (ctx.selfDraw) add('Self-draw', 1)
  else if (closedHand) add('Concealed hand', 1)
  if (ctx.selfDraw && ctx.afterKong) add('Win after a kong', 1)

  const pungs = groups.filter((g) => g.kind === 'pung')
  const dragonPungs = pungs.filter((g) => isDragon(g.tile)).length
  const windPungs = pungs.filter((g) => isWind(g.tile)).length
  const bigDragons = dragonPungs === 3
  const littleDragons = dragonPungs === 2 && isDragon(pair)
  const bigWinds = windPungs === 4
  const littleWinds = windPungs === 3 && isWind(pair)

  if (bigDragons) add('Big three dragons', 8)
  else if (littleDragons) add('Little three dragons', 4)
  else if (dragonPungs) add(dragonPungs === 1 ? 'Dragon pung' : 'Dragon pungs', dragonPungs)
  if (bigWinds) add('Big four winds', 16)
  else if (littleWinds) add('Little four winds', 8)
  else {
    for (const g of pungs) {
      if (g.tile === WIND_BASE + ctx.seatWind) add('Seat wind', 1)
      if (g.tile === WIND_BASE + ctx.roundWind) add('Round wind', 1)
      else if (ctx.windPungs === 'all' && isWind(g.tile) && g.tile !== WIND_BASE + ctx.seatWind) add('Wind pung', 1)
    }
  }

  const mine = seatFlowers(ctx.seatWind)
  const flowers = ctx.flowers.filter((f) => mine.includes(f)).length
  if (flowers) add(flowers === 1 ? 'Seat flower' : 'Seat flowers', flowers)

  if (groups.every((g) => g.kind === 'chow') && !isHonour(pair) && ctx.flowers.length === 0) add('All chows', 2)
  if (pungs.length === 5) add('All pungs', 4)

  const concealedPungs = pungs.filter((g) => !g.open).length
  if (concealedPungs === 5) add('Five concealed pungs', 8)
  else if (concealedPungs === 4) add('Four concealed pungs', 5)
  else if (concealedPungs === 3) add('Three concealed pungs', 2)

  if (!ctx.selfDraw && ctx.melds.length === 5 && ctx.melds.every((m) => m.open)) add('Melded hand', 2)

  const tiles = [pair, ...groups.map((g) => g.tile)]
  const suits = new Set(tiles.filter(isSuited).map(suitOf))
  const honours = tiles.some(isHonour)
  if (!tiles.some(isSuited)) add('All honours', 8)
  else if (suits.size === 1 && !honours) add('Full flush', 8)
  else if (suits.size === 1 && honours) add('Half flush', 4)

  return { tai: items.reduce((n, i) => n + i.tai, 0), items }
}
