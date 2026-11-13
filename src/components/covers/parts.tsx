/* eslint-disable react-refresh/only-export-components -- shared SVG helpers and constants, not a hot-reloaded component module */
import type { ReactNode } from 'react'

/** Resolves a material name to a paint server id, unique to one cover instance. */
export type Paint = (name: string) => string

type Stop = [number, string, number?]
const lin = (id: string, stops: Stop[], x2 = 0, y2 = 1) => ({ id, kind: 'linear' as const, stops, x2, y2 })
const rad = (id: string, stops: Stop[], cx = 0.5, cy = 0.4, r = 0.75) => ({ id, kind: 'radial' as const, stops, cx, cy, r })

/** Every material a cover can use. Pieces are lit from the top left; surfaces fall off toward the edges. */
export const MATERIALS = [
  lin('wood', [[0, '#efcd96'], [1, '#bb844c']]),
  lin('woodD', [[0, '#9a653a'], [1, '#5d3a21']]),
  lin('ivory', [[0, '#fffaf0'], [1, '#e2d5b6']]),
  rad('felt', [[0, '#2c8d66'], [1, '#124c39']]),
  rad('feltN', [[0, '#2b4a73'], [1, '#0e1d36']]),
  lin('red', [[0, '#ff7676'], [1, '#c02a3d']]),
  lin('blue', [[0, '#68a6ff'], [1, '#2158d4']]),
  lin('yellow', [[0, '#ffe780'], [1, '#e0a000']]),
  lin('green', [[0, '#5fdba6'], [1, '#12905f']]),
  lin('purple', [[0, '#bf9bff'], [1, '#6b3dd0']]),
  lin('orange', [[0, '#ffbb5c'], [1, '#e06d17']]),
  lin('teal', [[0, '#78e6f0'], [1, '#1a96ae']]),
  lin('rose', [[0, '#ff8fa8'], [1, '#d03a63']]),
  lin('ink', [[0, '#465167'], [1, '#141a26']]),
  lin('steel', [[0, '#e6eef9'], [1, '#8a9cb8']]),
  lin('gold', [[0, '#ffe590'], [1, '#c98c10']]),
  lin('sea', [[0, '#2377a0'], [1, '#0a2c45']]),
  lin('slate', [[0, '#2a3a52'], [1, '#111926']]),
  lin('gloss', [[0, '#ffffff', 0.55], [0.5, '#ffffff', 0.08], [1, '#ffffff', 0]]),
  lin('glass', [[0, '#ffffff', 0.3], [1, '#ffffff', 0.04]], 1, 0),
]

export function Defs({ u }: { u: string }) {
  return <defs>
    {MATERIALS.map((m) => m.kind === 'linear'
      ? <linearGradient key={m.id} id={`${u}-${m.id}`} x1="0" y1="0" x2={m.x2} y2={m.y2}>{m.stops.map(([o, c, a]) => <stop key={o} offset={o} stopColor={c} stopOpacity={a ?? 1} />)}</linearGradient>
      : <radialGradient key={m.id} id={`${u}-${m.id}`} cx={m.cx} cy={m.cy} r={m.r}>{m.stops.map(([o, c, a]) => <stop key={o} offset={o} stopColor={c} stopOpacity={a ?? 1} />)}</radialGradient>)}
    <radialGradient id={`${u}-bg`} cx="50%" cy="30%" r="90%"><stop offset="0" stopColor="currentColor" stopOpacity=".38" /><stop offset=".65" stopColor="currentColor" stopOpacity=".1" /><stop offset="1" stopColor="#000" stopOpacity=".35" /></radialGradient>
    <radialGradient id={`${u}-vig`} cx="50%" cy="50%" r="75%"><stop offset=".6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".45" /></radialGradient>
    <filter id={`${u}-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.4" /></filter>
    <filter id={`${u}-glow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
  </defs>
}

export const font = { fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800 } as const

/** A soft drop shadow under something at (cx, cy) about r wide. */
type N = number | string
export const Shadow = ({ u, cx, cy, rx, ry, o = 0.4 }: { u: string; cx: N; cy: N; rx: N; ry?: N; o?: number }) =>
  <ellipse cx={Number(cx)} cy={Number(cy)} rx={Number(rx)} ry={ry === undefined ? Number(rx) * 0.28 : Number(ry)} fill="#000" opacity={o} filter={`url(#${u}-soft)`} />

/** A lit disc: shadow, body, rim and a highlight. */
export function Disc({ u, f, cx: cx0, cy: cy0, r: r0, m, ring = true, shadow = true }: { u: string; f: Paint; cx: N; cy: N; r: N; m: string; ring?: boolean; shadow?: boolean }) {
  const cx = Number(cx0)
  const cy = Number(cy0)
  const r = Number(r0)
  return <g>
    {shadow ? <Shadow u={u} cx={cx + r * 0.1} cy={cy + r * 0.85} rx={r * 0.95} o={0.45} /> : null}
    <circle cx={cx} cy={cy} r={r} fill={f(m)} />
    {ring ? <circle cx={cx} cy={cy} r={r * 0.68} fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth={Math.max(0.4, r * 0.09)} /> : null}
    <ellipse cx={cx - r * 0.3} cy={cy - r * 0.4} rx={r * 0.42} ry={r * 0.24} fill="#fff" opacity=".5" />
    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#000" strokeOpacity=".25" strokeWidth=".5" />
  </g>
}

/** A die face with pips, 0-6. */
export function Die({ u, x: x0, y: y0, s: s0, n, rot = 0 }: { u: string; x: N; y: N; s: N; n: number; rot?: number }) {
  const x = Number(x0)
  const y = Number(y0)
  const s = Number(s0)
  const p = s * 0.24
  const spots: Record<number, [number, number][]> = {
    1: [[0.5, 0.5]], 2: [[0.28, 0.28], [0.72, 0.72]], 3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
    4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]], 5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
    6: [[0.28, 0.25], [0.72, 0.25], [0.28, 0.5], [0.72, 0.5], [0.28, 0.75], [0.72, 0.75]],
  }
  return <g transform={`rotate(${rot} ${x + s / 2} ${y + s / 2})`}>
    <Shadow u={u} cx={x + s * 0.55} cy={y + s * 1.02} rx={s * 0.6} o={0.4} />
    <rect x={x} y={y} width={s} height={s} rx={s * 0.2} fill={`url(#${u}-ivory)`} />
    <rect x={x} y={y} width={s} height={s} rx={s * 0.2} fill="none" stroke="#000" strokeOpacity=".22" strokeWidth=".5" />
    {(spots[n] ?? []).map(([a, b], i) => <circle key={i} cx={x + a * s} cy={y + b * s} r={p * 0.5} fill="#1b2230" />)}
  </g>
}

export type Suit = 'S' | 'H' | 'D' | 'C'
const RED = '#d4283e'
const BLACK = '#18202e'

/** A suit pip centred on (0,0), about 11 units tall. */
export function SuitPip({ suit, fill }: { suit: Suit; fill?: string }) {
  const c = fill ?? (suit === 'H' || suit === 'D' ? RED : BLACK)
  if (suit === 'H') return <path d="M0 4.4 C-6.8 -0.9 -4.8 -5.8 -1.9 -5.8 C-0.6 -5.8 0 -4.9 0 -4 C0 -4.9 0.6 -5.8 1.9 -5.8 C4.8 -5.8 6.8 -0.9 0 4.4Z" fill={c} />
  if (suit === 'D') return <path d="M0 -5.8 L4.4 0 L0 5.8 L-4.4 0Z" fill={c} />
  if (suit === 'S') return <path d="M0 -5.8 C-1 -3 -6.2 -1.6 -5 1.9 C-4 4.2 -1.3 3.4 -0.9 2.1 C-1 3.9 -1.5 5 -2.7 5.8 H2.7 C1.5 5 1 3.9 0.9 2.1 C1.3 3.4 4 4.2 5 1.9 C6.2 -1.6 1 -3 0 -5.8Z" fill={c} />
  return <g fill={c}><circle cx="0" cy="-2.7" r="2.5" /><circle cx="-2.9" cy="1" r="2.5" /><circle cx="2.9" cy="1" r="2.5" /><path d="M-1 1 H1 L1.9 5.8 H-1.9Z" /></g>
}

/** A playing card, face up (rank + suit) or face down. Rotates about its own centre. */
export function Card({ u, x, y, w = 24, h = 34, rot = 0, rank, suit, back = false, back2 = '#2457d6' }: { u: string; x: number; y: number; w?: number; h?: number; rot?: number; rank?: string; suit?: Suit; back?: boolean; back2?: string }) {
  const s = w / 24
  const cx = x + w / 2
  const cy = y + h / 2
  return <g transform={`rotate(${rot} ${cx} ${cy})`}>
    <rect x={x + 0.8} y={y + 1.6} width={w} height={h} rx={3 * s} fill="#000" opacity=".35" filter={`url(#${u}-soft)`} />
    <rect x={x} y={y} width={w} height={h} rx={3 * s} fill={back ? back2 : `url(#${u}-ivory)`} />
    <rect x={x} y={y} width={w} height={h} rx={3 * s} fill="none" stroke="#000" strokeOpacity=".3" strokeWidth=".5" />
    {back ? <g>
      <rect x={x + 2.2 * s} y={y + 2.2 * s} width={w - 4.4 * s} height={h - 4.4 * s} rx={1.6 * s} fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".7" />
      <path d={`M${cx} ${y + 6 * s} L${x + w - 5 * s} ${cy} L${cx} ${y + h - 6 * s} L${x + 5 * s} ${cy}Z`} fill="#fff" opacity=".22" />
    </g> : <g>
      <text x={x + 2.6 * s} y={y + 8 * s} fontSize={7.2 * s} {...font} fill={suit === 'H' || suit === 'D' ? RED : BLACK}>{rank}</text>
      {suit ? <g transform={`translate(${x + 5 * s} ${y + 13.2 * s}) scale(${0.42 * s})`}><SuitPip suit={suit} /></g> : null}
      {suit ? <g transform={`translate(${cx + 1.2 * s} ${cy + 5.5 * s}) scale(${1.05 * s})`}><SuitPip suit={suit} /></g> : null}
    </g>}
  </g>
}

/** The cover's own background: a dim tabletop lit from above, tinted by the category colour. */
export function Table({ u, y = 0, children }: { u: string; y?: number; children?: ReactNode }) {
  return <g>
    <rect y={y} width="160" height={90 - y} fill={`url(#${u}-bg)`} />
    {children}
  </g>
}
