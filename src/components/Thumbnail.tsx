import type { ReactNode } from 'react'

/**
 * 160x90 stand-ins for screenshots, one per game. Drawn with currentColor (the category colour), amber for one highlight
 * and off-white for neutrals; a handful of shapes each, no gradients. Decorative: the card carries the game's name.
 */
const H = '#FFB547'
const N = '#EEF1F8'

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const grid = (cols: number, rows: number, x: number, y: number, s: number, gap: number) =>
  Array.from({ length: cols * rows }, (_, i) => ({ x: x + (i % cols) * (s + gap), y: y + Math.floor(i / cols) * (s + gap), i }))

const ART: Record<string, ReactNode> = {
  bazaar: <><path d="M43 35 L53 17 H107 L117 35 Z" fill={H} /><path d="M43 35 H117 M48 36 V75 H112 V36 M76 75 V49 H100 V75 M56 49 H68 V62 H56 Z" {...stroke} /><path d="M66 17 L62 35 M94 17 L98 35" stroke={N} strokeWidth="3" /></>,
  'neon-merge': <>{grid(2, 2, 46, 12, 32, 4).map((t) => <rect key={t.i} x={t.x} y={t.y} width="32" height="32" rx="6" {...(t.i === 3 ? { fill: H } : { ...stroke })} />)}</>,
  'memory-grid': <>{grid(3, 2, 30, 14, 28, 8).map((t) => <rect key={t.i} x={t.x} y={t.y} width="28" height="28" rx="6" {...(t.i === 1 ? { fill: H } : t.i === 4 ? { fill: 'currentColor' } : { ...stroke })} />)}</>,
  'pulse-tap': <><circle cx="80" cy="45" r="36" {...stroke} /><circle cx="80" cy="45" r="22" {...stroke} /><circle cx="80" cy="45" r="8" fill={H} /></>,
  minesweeper: <>{grid(5, 3, 34, 14, 17, 5).map((t) => <rect key={t.i} x={t.x} y={t.y} width="17" height="17" rx="3" {...(t.i === 6 ? { fill: 'currentColor' } : { ...stroke, strokeWidth: 1.5 })} />)}<path d="M96 56 v-10 l8 4 z" fill={H} /><circle cx="52" cy="53" r="4" fill={N} /></>,
  'neon-snake': <><path d="M26 66 H70 V34 H112 V58" {...stroke} strokeWidth="8" /><circle cx="112" cy="58" r="7" fill={H} /><circle cx="132" cy="28" r="5" fill={N} /></>,
  'color-sort': <>{[40, 70, 100].map((x, i) => <g key={x}><rect x={x} y="12" width="20" height="66" rx="10" {...stroke} /><rect x={x + 4} y="52" width="12" height="14" rx="3" fill={i === 1 ? H : 'currentColor'} /><rect x={x + 4} y={i === 2 ? 54 : 38} width="12" height="12" rx="3" fill={i === 0 ? N : 'currentColor'} /></g>)}</>,
  'connect-four': <>{grid(5, 4, 34, 11, 14, 8).map((t) => <circle key={t.i} cx={t.x + 7} cy={t.y + 7} r="7" {...([14, 15, 16, 17].includes(t.i) ? { fill: t.i === 16 ? H : 'currentColor' } : { ...stroke, strokeWidth: 1.5 })} />)}</>,
  'tic-tac-toe': <><path d="M62 14 V76 M98 14 V76 M40 34 H120 M40 56 H120" stroke={N} strokeWidth="2.5" strokeLinecap="round" /><path d="M44 16 l12 12 m0 -12 l-12 12" {...stroke} /><circle cx="80" cy="45" r="7" fill="none" stroke={H} strokeWidth="2.5" /><circle cx="116" cy="66" r="7" {...stroke} /></>,
  checkers: <>{grid(4, 4, 50, 8, 15, 0).map((t) => ((t.i % 4) + Math.floor(t.i / 4)) % 2 ? <rect key={t.i} x={t.x} y={t.y} width="15" height="15" fill="currentColor" opacity=".35" /> : null)}<rect x="50" y="8" width="60" height="60" {...stroke} strokeWidth="1.5" /><circle cx="73" cy="30" r="5.5" fill={H} /><circle cx="88" cy="45" r="5.5" fill={N} /></>,
  battleship: <>{grid(6, 4, 32, 14, 12, 8).map((t) => <circle key={t.i} cx={t.x + 6} cy={t.y + 6} r="2" fill={N} opacity=".5" />)}<rect x="48" y="42" width="52" height="12" rx="6" {...stroke} /><circle cx="86" cy="48" r="5" fill={H} /></>,
  'daily-word': <>{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={20 + i * 25} y="30" width="21" height="28" rx="4" {...(i === 1 ? { fill: H } : i === 3 ? { fill: 'currentColor' } : { ...stroke })} />)}</>,
  'brick-breaker': <>{grid(5, 3, 30, 12, 20, 4).map((t) => <rect key={t.i} x={t.x} y={t.y} width="20" height="9" rx="2" fill={t.i === 7 ? H : 'currentColor'} opacity={t.i === 7 ? 1 : 0.9 - Math.floor(t.i / 5) * 0.2} />)}<circle cx="94" cy="60" r="4" fill={N} /><rect x="60" y="76" width="42" height="6" rx="3" fill={N} /></>,
  'neon-pong': <><path d="M80 8 V82" stroke="currentColor" strokeWidth="2" strokeDasharray="5 6" /><rect x="22" y="28" width="6" height="30" rx="3" fill={N} /><rect x="132" y="38" width="6" height="30" rx="3" fill={N} /><circle cx="98" cy="48" r="5" fill={H} /></>,
  'sudoku-master': <><rect x="40" y="6" width="80" height="78" rx="4" {...stroke} /><path d="M66.7 6 V84 M93.3 6 V84 M40 32 H120 M40 58 H120" stroke="currentColor" strokeWidth="1.5" /><rect x="46" y="12" width="8" height="8" fill={N} /><rect x="100" y="38" width="8" height="8" fill={H} /><rect x="72" y="64" width="8" height="8" fill={N} /></>,
  'space-defender': <><path d="M80 52 l12 24 h-24 z" fill={N} />{[44, 66, 88, 110].map((x) => <rect key={x} x={x} y="14" width="12" height="9" rx="2" fill="currentColor" />)}<path d="M80 44 V30" stroke={H} strokeWidth="3" strokeLinecap="round" /></>,
  'gravity-flip': <><path d="M26 18 H134 M26 72 H134" {...stroke} /><rect x="50" y="52" width="16" height="16" rx="3" fill={N} /><path d="M104 56 V34 m-8 8 l8 -8 l8 8" fill="none" stroke={H} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></>,
  vibeline: <><path d="M32 62 L62 28 L96 60 L128 26" fill="none" stroke={N} strokeWidth="2" strokeLinejoin="round" /><circle cx="32" cy="62" r="7" fill="currentColor" /><circle cx="62" cy="28" r="7" fill={H} /><circle cx="96" cy="60" r="7" fill="currentColor" /><circle cx="128" cy="26" r="7" fill="currentColor" /></>,
  twofold: <><path d="M50 10 H110 V80 H50 z" {...stroke} /><path d="M50 10 L110 80 H50 z" fill="currentColor" opacity=".5" /><path d="M50 10 L110 80" stroke={H} strokeWidth="3" strokeLinecap="round" /></>,
  carve: <><rect x="40" y="16" width="80" height="58" rx="4" {...stroke} /><path d="M40 52 H84 V16" fill="none" stroke={H} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><rect x="44" y="20" width="36" height="28" fill="currentColor" opacity=".45" /></>,
  'ghata-bara': <><rect x="40" y="8" width="74" height="74" rx="4" {...stroke} /><path d="M40 8 L114 82 M114 8 L40 82" stroke={N} strokeWidth="1.5" opacity=".5" /><rect x="68" y="36" width="18" height="18" fill="none" stroke={N} strokeWidth="2" /><circle cx="77" cy="18" r="5" fill={H} /><circle cx="50" cy="45" r="5" fill="currentColor" /><circle cx="104" cy="45" r="5" fill="currentColor" /><circle cx="77" cy="72" r="5" fill="currentColor" /></>,
  pallanguzhi: <>{grid(7, 2, 22, 24, 14, 6).map((t) => <g key={t.i}><circle cx={t.x + 7} cy={t.y + 7} r="8" {...stroke} strokeWidth="1.8" /><circle cx={t.x + 7} cy={t.y + 7} r="3" fill={t.i === 4 ? H : 'currentColor'} /></g>)}</>,
}

export function Thumbnail({ id }: { id: string }) {
  return (
    <svg className="thumb-art" viewBox="0 0 160 90" aria-hidden="true" focusable="false">
      {ART[id] ?? <circle cx="80" cy="45" r="20" {...stroke} />}
    </svg>
  )
}

export const THUMBNAIL_IDS = Object.keys(ART)
