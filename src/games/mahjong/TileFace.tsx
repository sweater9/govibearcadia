import { isFlower, isHonour, rankOf, suitOf } from './tiles'

/** Pip positions (in a 24 x 34 field) for the dot and bamboo tiles, one layout per count. */
const GRID: Record<number, [number, number][]> = {
  1: [[12, 17]],
  2: [[12, 9], [12, 25]],
  3: [[6, 7], [12, 17], [18, 27]],
  4: [[7, 9], [17, 9], [7, 25], [17, 25]],
  5: [[7, 8], [17, 8], [12, 17], [7, 26], [17, 26]],
  6: [[7, 8], [17, 8], [7, 17], [17, 17], [7, 26], [17, 26]],
  7: [[12, 6], [7, 14], [17, 14], [12, 22], [7, 30], [12, 30], [17, 30]],
  8: [[7, 7], [17, 7], [7, 14], [17, 14], [7, 21], [17, 21], [7, 28], [17, 28]],
  9: [[6, 8], [12, 8], [18, 8], [6, 17], [12, 17], [18, 17], [6, 26], [12, 26], [18, 26]],
}

function Dots({ n }: { n: number }) {
  const r = n === 1 ? 8 : n <= 3 ? 4.6 : n <= 6 ? 3.8 : 3.2
  const colour = (i: number) => (n === 1 ? '#1f5fa8' : n >= 7 && i < 3 ? '#c23a2f' : i % 2 ? '#1f7a43' : '#1f5fa8')
  return <g>{GRID[n].map(([x, y], i) => <g key={i}>
    <circle cx={x} cy={y} r={r} fill={colour(i)} />
    <circle cx={x} cy={y} r={r * 0.55} fill="none" stroke="#f5efe2" strokeWidth={Math.max(0.7, r * 0.18)} />
    <circle cx={x} cy={y} r={r * 0.2} fill={n === 1 ? '#c23a2f' : '#f5efe2'} />
  </g>)}</g>
}

function Stick({ x, y, h, colour }: { x: number; y: number; h: number; colour: string }) {
  return <g>
    <rect x={x - 1.7} y={y - h / 2} width="3.4" height={h} rx="1.7" fill={colour} />
    <path d={`M${x - 1.7} ${y} h3.4`} stroke="#f5efe2" strokeWidth=".8" />
    <rect x={x - 0.5} y={y - h / 2 + 1} width="1" height={h - 2} rx=".5" fill="#fff" opacity=".28" />
  </g>
}

function Bamboo({ n }: { n: number }) {
  if (n === 1) return <g>
    <path d="M12 30 C 6 22 8 14 12 6 C 16 14 18 22 12 30Z" fill="#1f7a43" />
    <circle cx="12" cy="9" r="2" fill="#c23a2f" /><path d="M12 30 V13" stroke="#f5efe2" strokeWidth=".9" />
  </g>
  const h = n <= 3 ? 11 : n <= 6 ? 8.5 : 6.6
  return <g>{GRID[n].map(([x, y], i) => <Stick key={i} x={x} y={y} h={h} colour={n === 5 && i === 2 ? '#c23a2f' : n >= 7 && i === 0 ? '#c23a2f' : '#1f7a43'} />)}</g>
}

function Characters({ n }: { n: number }) {
  return <g>
    <text x="12" y="20" textAnchor="middle" fontSize="19" fontWeight="800" fill="#b3261e" fontFamily="var(--font-display), system-ui, sans-serif">{n}</text>
    <path d="M5 27 h14 M7 24.4 h10 M12 24.4 v5.6" stroke="#1d1d1d" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M7.5 31 q4.5 -2 9 0" stroke="#b3261e" strokeWidth="1.6" strokeLinecap="round" fill="none" />
  </g>
}

const WIND_LETTER = ['E', 'S', 'W', 'N']
function Honour({ t }: { t: number }) {
  const i = t - 27
  if (i < 4) return <g>
    <circle cx="12" cy="17" r="10.5" fill="none" stroke="#1d1d1d" strokeWidth="1.2" />
    <text x="12" y="23.4" textAnchor="middle" fontSize="18" fontWeight="800" fill="#1d1d1d" fontFamily="var(--font-display), system-ui, sans-serif">{WIND_LETTER[i]}</text>
  </g>
  if (i === 4) return <g><rect x="4" y="5" width="16" height="24" rx="3" fill="none" stroke="#c23a2f" strokeWidth="2.2" /><path d="M12 8 V27 M7 14 H17 M7 21 H17" stroke="#c23a2f" strokeWidth="2.2" strokeLinecap="round" /></g>
  if (i === 5) return <g><path d="M12 5 C 20 11 20 22 12 29 C 4 22 4 11 12 5Z" fill="#1f7a43" /><path d="M12 8 V27 M12 14 L7 11 M12 20 L17 17 M12 24 L8 22" stroke="#f5efe2" strokeWidth="1.3" strokeLinecap="round" fill="none" /></g>
  return <g><rect x="4.5" y="5.5" width="15" height="23" rx="3" fill="none" stroke="#1f5fa8" strokeWidth="2" /><rect x="8" y="9.5" width="8" height="15" rx="1.6" fill="none" stroke="#1f5fa8" strokeWidth="1.2" /></g>
}

const FLOWER_COLOURS = ['#d2584a', '#2f8f5a', '#c9892b', '#4a6fb5', '#b04a8a', '#8a56c2', '#d1a233', '#2f8f87']
function Flower({ t }: { t: number }) {
  const k = t - 34
  const c = FLOWER_COLOURS[k]
  return <g>
    {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="12" cy="11" rx="3.6" ry="5.6" fill={c} opacity=".9" transform={`rotate(${a} 12 16)`} />)}
    <circle cx="12" cy="16" r="3" fill="#f5efe2" stroke={c} strokeWidth="1" />
    <text x="12" y="32" textAnchor="middle" fontSize="7.5" fontWeight="800" fill={c} fontFamily="system-ui, sans-serif">{(k % 4) + 1}</text>
  </g>
}

/** The painted face of a Mahjong tile: real dot and bamboo layouts, numbered characters, winds, dragons and flowers. */
export function TileFace({ t }: { t: number }) {
  return <svg className="mj-face" viewBox="0 0 24 34" aria-hidden="true" focusable="false">
    {isFlower(t) ? <Flower t={t} /> : isHonour(t) ? <Honour t={t} /> : suitOf(t) === 0 ? <Characters n={rankOf(t)} /> : suitOf(t) === 1 ? <Dots n={rankOf(t)} /> : <Bamboo n={rankOf(t)} />}
  </svg>
}

