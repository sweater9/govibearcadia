import { DEFAULT_CONFIG, type Config } from './rules'

const KEY = 'govibearcadia.mahjong.rules'

export const STAKES = [
  { id: '30-10', label: '30 + 10 per tai', base: 30, unit: 10 },
  { id: '50-20', label: '50 + 20 per tai', base: 50, unit: 20 },
  { id: '100-20', label: '100 + 20 per tai', base: 100, unit: 20 },
] as const

export const OPTIONS = {
  match: [['single', 'Single hand'], ['east', 'East round'], ['east-south', 'East and South']],
  dealerBonus: [['streak', '1 + 2 per kept deal'], ['flat', '1 tai flat'], ['none', 'None']],
  windPungs: [['seat-round', 'Seat and round wind'], ['all', 'Any wind pung']],
  minTai: [['0', 'Any winning hand'], ['1', '1 tai minimum'], ['3', '3 tai minimum']],
} as const

/** Fill in and clamp every field, so a saved or hand-edited config can never break the rules engine. */
export function normaliseConfig(c: Partial<Config> | null | undefined): Config {
  const d = DEFAULT_CONFIG
  const pick = <T extends string>(v: unknown, list: readonly (readonly [T, string])[], fallback: T): T => (list.some(([k]) => k === v) ? (v as T) : fallback)
  const stake = STAKES.find((s) => s.base === c?.base && s.unit === c?.unit) ?? STAKES[0]
  return {
    match: pick(c?.match, OPTIONS.match, d.match),
    dealerBonus: pick(c?.dealerBonus, OPTIONS.dealerBonus, d.dealerBonus),
    windPungs: pick(c?.windPungs, OPTIONS.windPungs, d.windPungs),
    minTai: [0, 1, 3].includes(c?.minTai as number) ? (c?.minTai as number) : d.minTai,
    base: stake.base,
    unit: stake.unit,
    start: d.start,
  }
}

export const isStandard = (c: Config) => JSON.stringify(normaliseConfig(c)) === JSON.stringify(DEFAULT_CONFIG)

export function describeConfig(c: Config): string {
  const parts = [OPTIONS.match.find(([k]) => k === c.match)?.[1], `${c.base} + ${c.unit} per tai`]
  if (c.minTai) parts.push(`${c.minTai} tai minimum`)
  if (c.windPungs === 'all') parts.push('any wind pung scores')
  if (c.dealerBonus !== 'streak') parts.push(c.dealerBonus === 'flat' ? 'dealer +1 flat' : 'no dealer bonus')
  return parts.join(', ')
}

export function loadRules(): Config {
  try {
    const raw = localStorage.getItem(KEY)
    return normaliseConfig(raw ? (JSON.parse(raw) as Partial<Config>) : null)
  } catch {
    return DEFAULT_CONFIG
  }
}
export function saveRules(c: Config) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* ignore */
  }
}
