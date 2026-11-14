import { useId, type ReactNode } from 'react'
import { COVERS } from './covers'
import { Defs } from './covers/parts'

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
  'aadu-puli-attam': <><path d="M80 8 L28 78 H132 Z M80 8 L50 78 M80 8 L70 78 M80 8 L90 78 M80 8 L110 78 M48 34 H112 M38 55 H122" {...stroke} strokeWidth="1.8" /><circle cx="80" cy="8" r="5" fill={H} /><circle cx="75" cy="34" r="5" fill={H} /><circle cx="85" cy="34" r="5" fill={H} /><circle cx="48" cy="55" r="3.5" fill={N} /><circle cx="70" cy="55" r="3.5" fill={N} /><circle cx="100" cy="55" r="3.5" fill={N} /></>,
  pallanguzhi: <>{grid(7, 2, 22, 24, 14, 6).map((t) => <g key={t.i}><circle cx={t.x + 7} cy={t.y + 7} r="8" {...stroke} strokeWidth="1.8" /><circle cx={t.x + 7} cy={t.y + 7} r="3" fill={t.i === 4 ? H : 'currentColor'} /></g>)}</>,
  carrom: <><rect x="50" y="6" width="78" height="78" rx="4" {...stroke} /><circle cx="89" cy="45" r="8" fill={H} /><circle cx="89" cy="27" r="6" fill="currentColor" /><circle cx="107" cy="45" r="6" {...stroke} /><circle cx="71" cy="45" r="6" fill="currentColor" /><circle cx="89" cy="63" r="6" {...stroke} /><circle cx="54" cy="10" r="5" fill={N} /><circle cx="124" cy="80" r="5" fill={N} /><circle cx="54" cy="80" r="5" fill={N} /><circle cx="124" cy="10" r="5" fill={N} /></>,
  'indian-rummy': <><rect x="38" y="20" width="34" height="48" rx="4" transform="rotate(-14 55 44)" {...stroke} /><rect x="60" y="16" width="34" height="48" rx="4" {...stroke} /><rect x="84" y="20" width="34" height="48" rx="4" transform="rotate(14 101 44)" {...stroke} /><circle cx="77" cy="40" r="7" fill={H} /><path d="M46 36h10M110 36h-10" stroke={N} strokeWidth="2" /></>,
  klondike: <><rect x="30" y="46" width="26" height="36" rx="3" {...stroke} opacity=".5" /><rect x="46" y="38" width="26" height="36" rx="3" {...stroke} opacity=".75" /><rect x="62" y="30" width="26" height="36" rx="3" {...stroke} /><text x="68" y="52" fontSize="18" fontWeight="700" fill={N}>K</text><rect x="104" y="18" width="26" height="36" rx="3" fill="none" stroke={H} strokeWidth="3" strokeDasharray="4 3" /></>,
  blackjack: <><rect x="40" y="22" width="34" height="48" rx="4" transform="rotate(-8 57 46)" {...stroke} /><rect x="76" y="20" width="34" height="48" rx="4" transform="rotate(8 93 44)" {...stroke} /><text x="48" y="48" fontSize="18" fontWeight="700" fill={H}>A</text><text x="86" y="46" fontSize="18" fontWeight="700" fill={N}>K</text></>,
  poker: <><rect x="34" y="40" width="26" height="36" rx="3" transform="rotate(-10 47 58)" {...stroke} /><rect x="58" y="40" width="26" height="36" rx="3" transform="rotate(8 71 58)" {...stroke} /><circle cx="108" cy="30" r="12" fill="none" stroke={H} strokeWidth="3" strokeDasharray="4 3" /><circle cx="122" cy="52" r="9" fill="none" stroke={N} strokeWidth="3" strokeDasharray="3 3" /><path d="M36 22h60" {...stroke} opacity=".5" /></>,
  'world-trip': <><rect x="46" y="18" width="68" height="54" rx="4" {...stroke} /><rect x="60" y="32" width="40" height="26" rx="2" {...stroke} /><circle cx="46" cy="72" r="5" fill={H} /><circle cx="114" cy="18" r="5" fill={N} /><path d="M72 46 L88 40 L82 52 Z" fill={H} /></>,
  ludo: <><path d="M62 6h20v22H62zM82 28h22v20H82zM62 48h20v26H62zM40 28h22v20H40z" {...stroke} /><rect x="66" y="34" width="12" height="12" rx="2" fill={H} /><circle cx="72" cy="14" r="5" fill={N} /><circle cx="94" cy="38" r="5" fill={H} /><circle cx="72" cy="62" r="5" fill={N} /><circle cx="50" cy="38" r="5" fill={H} /></>,
  'taiwanese-mahjong': <><rect x="52" y="22" width="24" height="34" rx="4" {...stroke} /><rect x="80" y="22" width="24" height="34" rx="4" fill={H} /><rect x="108" y="22" width="24" height="34" rx="4" {...stroke} /><circle cx="64" cy="39" r="5" fill="currentColor" /><path d="M88 32h8M88 39h8M88 46h8" stroke="currentColor" strokeWidth="2.5" /><path d="M120 32l-6 14h12z" fill="currentColor" /><rect x="66" y="62" width="24" height="16" rx="4" {...stroke} /><rect x="94" y="62" width="24" height="16" rx="4" {...stroke} /></>,
}

/** A few stable twinkles per game, from its id, so each cover has its own sky without any randomness at render time. */
function sparkles(id: string) {
  let h = 7
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const next = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296)
  return Array.from({ length: 7 }, () => ({ x: 6 + next() * 148, y: 5 + next() * 80, r: 0.6 + next() * 1.3, o: 0.25 + next() * 0.5 }))
}

/** The cover: a lit scene (gradient, glow, floor light, twinkles) behind the game's own drawing, which gets depth from a soft shadow. */
export function Thumbnail({ id }: { id: string }) {
  const uid = useId().replace(/:/g, '')
  const cover = COVERS[id]
  if (cover) {
    const paint = (name: string) => `url(#${uid}-${name})`
    return (
      <svg className="thumb-art thumb-cover" viewBox="0 0 160 90" aria-hidden="true" focusable="false">
        <Defs u={uid} />
        <rect width="160" height="90" fill={`url(#${uid}-bg)`} />
        {cover(uid, paint)}
        <rect width="160" height="90" fill={`url(#${uid}-vig)`} />
      </svg>
    )
  }
  return (
    <svg className="thumb-art" viewBox="0 0 160 90" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${uid}g`} cx="50%" cy="38%" r="70%">
          <stop offset="0" stopColor="currentColor" stopOpacity=".34" />
          <stop offset=".6" stopColor="currentColor" stopOpacity=".08" />
          <stop offset="1" stopColor="#000" stopOpacity=".25" />
        </radialGradient>
        <linearGradient id={`${uid}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="1" stopColor="currentColor" stopOpacity=".28" />
        </linearGradient>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".16" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="160" height="90" fill={`url(#${uid}g)`} />
      <rect y="58" width="160" height="32" fill={`url(#${uid}f)`} />
      {sparkles(id).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#fff" opacity={p.o} />)}
      <ellipse cx="80" cy="80" rx="44" ry="5" fill="#000" opacity=".28" />
      <g className="thumb-fg" transform="translate(80 45) scale(1.08) translate(-80 -45)">
        {ART[id] ?? <circle cx="80" cy="45" r="20" {...stroke} />}
      </g>
      <rect width="160" height="90" fill={`url(#${uid}s)`} />
    </svg>
  )
}

export const THUMBNAIL_IDS = Object.keys(ART)
