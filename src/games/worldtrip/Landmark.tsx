import type { Landmark } from './board'

/** Small original landmark pictures (80x48), drawn from simple shapes. Colours are fixed warm tones so they read on the card in any theme. */
const INK = '#3b2a1e'
const SKY = '#f3e1c3'
const SEA = '#7fb3b0'

export function LandmarkArt({ kind, city, decorative = false }: { kind: Landmark; city?: string; decorative?: boolean }) {
  const body = (() => {
    switch (kind) {
      case 'mountains': // Vancouver: mountains behind a waterfront skyline
        return <>
          <path d="M0 34 L18 10 L28 22 L40 6 L58 30 L68 18 L80 34 Z" fill="#9aa9a1" />
          <path d="M40 6 L34 16 L40 14 L46 17 Z M18 10 L14 17 L18 15 L22 18 Z" fill="#fff8ee" />
          {[8, 20, 30, 42, 52, 62].map((x, i) => <rect key={x} x={x} y={28 - (i % 3) * 3} width="7" height={14 + (i % 3) * 3} fill="#6b7280" />)}
          <rect x="0" y="40" width="80" height="8" fill={SEA} />
        </>
      case 'waterfront': // Copenhagen: the Nyhavn waterfront, tall gabled houses in a row
        return <>
          {['#c2410c', '#eab308', '#0f766e', '#be185d', '#1d4ed8', '#d97706'].map((c, i) => <g key={c}>
            <rect x={4 + i * 12} y={14 + (i % 2) * 4} width="11" height={24 - (i % 2) * 4} fill={c} />
            <path d={`M${4 + i * 12} ${14 + (i % 2) * 4} L${9.5 + i * 12} ${8 + (i % 2) * 4} L${15 + i * 12} ${14 + (i % 2) * 4} Z`} fill={INK} opacity=".7" />
            <rect x={7 + i * 12} y={20 + (i % 2) * 4} width="2.5" height="3.5" fill={SKY} /><rect x={11 + i * 12} y={20 + (i % 2) * 4} width="2.5" height="3.5" fill={SKY} />
          </g>)}
          <rect x="0" y="38" width="80" height="10" fill={SEA} />
          <path d="M18 43 L24 43 M45 44 L53 44" stroke="#fff8ee" strokeWidth="1.2" />
          <path d="M60 34 V24 M60 26 L68 34 H58" stroke={INK} strokeWidth="1.2" fill="none" />
        </>
      case 'tower': return <><path d="M40 4 L46 36 H34 Z" fill="#8a6a4a" /><rect x="30" y="36" width="20" height="4" fill={INK} /><circle cx="40" cy="14" r="3" fill={SKY} /><rect x="0" y="40" width="80" height="8" fill="#c9b79a" /></>
      case 'skyline': return <>{[6, 16, 26, 38, 50, 60].map((x, i) => <rect key={x} x={x} y={8 + ((i * 7) % 16)} width="9" height={40 - (8 + ((i * 7) % 16))} fill={i % 2 ? '#6b7280' : '#8a6a4a'} />)}<path d="M72 14 L75 40 H69 Z" fill="#7fb3b0" /></>
      case 'bridge': return <><rect x="0" y="32" width="80" height="3" fill={INK} /><path d="M18 8 V32 M62 8 V32" stroke="#c2410c" strokeWidth="3" /><path d="M0 30 Q18 10 40 28 Q62 10 80 30" stroke="#c2410c" strokeWidth="1.4" fill="none" /><rect x="0" y="38" width="80" height="10" fill={SEA} /></>
      case 'columns': return <><path d="M10 14 H70 L40 4 Z" fill="#c9b79a" />{[16, 28, 40, 52, 64].map((x) => <rect key={x} x={x - 3} y="14" width="6" height="26" fill="#e8dcc2" />)}<rect x="8" y="40" width="64" height="5" fill="#a8946f" /></>
      case 'dome': return <><path d="M20 36 A20 20 0 0 1 60 36 Z" fill="#c2410c" /><rect x="38" y="6" width="4" height="10" fill={INK} /><rect x="16" y="36" width="48" height="8" fill="#e8dcc2" /><path d="M10 44 V20 M70 44 V20" stroke={INK} strokeWidth="3" /></>
      case 'pagoda': return <>{[0, 1, 2].map((i) => <g key={i}><path d={`M${22 + i * 4} ${16 + i * 10} H${58 - i * 4} L${54 - i * 4} ${10 + i * 10} H${26 + i * 4} Z`} fill="#b91c1c" /><rect x={30 + i * 3} y={16 + i * 10} width={20 - i * 6} height="6" fill="#e8dcc2" /></g>)}<rect x="36" y="2" width="8" height="6" fill="#d97706" /></>
      case 'sails': return <><path d="M20 38 L40 6 V38 Z M44 38 L62 14 V38 Z" fill="#fff8ee" stroke={INK} strokeWidth="1" /><path d="M12 40 H68 L62 46 H18 Z" fill="#8a6a4a" /><rect x="0" y="42" width="80" height="6" fill={SEA} opacity=".6" /></>
      case 'pyramid': return <><path d="M10 40 L36 10 L62 40 Z" fill="#d9a35a" /><path d="M36 10 L62 40 H36 Z" fill="#b8843c" /><path d="M54 40 L66 24 L78 40 Z" fill="#c4914a" /><circle cx="70" cy="8" r="4" fill="#f0c35a" /></>
      case 'palm': return <><path d="M40 44 Q38 28 42 14" stroke="#8a6a4a" strokeWidth="3" fill="none" />{[-40, -10, 20, 50, 80].map((r) => <path key={r} d="M42 14 Q54 8 62 16" stroke="#4d7c0f" strokeWidth="3" fill="none" transform={`rotate(${r} 42 14)`} />)}<rect x="0" y="42" width="80" height="6" fill="#e8d5a8" /></>
      case 'canal': return <>{['#b91c1c', '#d97706', '#4d7c0f', '#1d4ed8'].map((c, i) => <g key={c}><path d={`M${6 + i * 17} 38 V18 H${19 + i * 17} V38 Z`} fill={c} /><path d={`M${6 + i * 17} 18 L${12.5 + i * 17} 10 L${19 + i * 17} 18`} fill={INK} opacity=".6" /></g>)}<rect x="0" y="38" width="80" height="10" fill={SEA} /></>
      case 'windmill': return <><path d="M32 40 L36 18 H44 L48 40 Z" fill="#8a6a4a" />{[0, 90, 180, 270].map((r) => <rect key={r} x="39" y="2" width="2" height="16" fill={INK} transform={`rotate(${r + 20} 40 18)`} />)}</>
      case 'castle': return <><rect x="14" y="16" width="52" height="24" fill="#a8946f" />{[14, 28, 42, 56].map((x) => <rect key={x} x={x} y="11" width="8" height="6" fill="#a8946f" />)}<rect x="34" y="26" width="12" height="14" fill={INK} /><path d="M10 16 V40 M70 16 V40" stroke="#8a6a4a" strokeWidth="6" /></>
      case 'tram': return <><rect x="14" y="16" width="52" height="20" rx="4" fill="#d9a35a" /><rect x="20" y="20" width="10" height="8" fill={SKY} /><rect x="35" y="20" width="10" height="8" fill={SKY} /><rect x="50" y="20" width="10" height="8" fill={SKY} /><path d="M40 16 V6 M30 6 H50" stroke={INK} strokeWidth="1.4" /><rect x="0" y="40" width="80" height="2" fill={INK} /><circle cx="24" cy="38" r="3" fill={INK} /><circle cx="56" cy="38" r="3" fill={INK} /></>
      case 'arch': return <><path d="M14 44 V18 A26 26 0 0 1 66 18 V44 H56 V20 A16 16 0 0 0 24 20 V44 Z" fill="#c2410c" /><rect x="10" y="44" width="60" height="3" fill={INK} /></>
      default: return <rect x="20" y="10" width="40" height="30" fill="#a8946f" />
    }
  })()
  return <svg className={decorative ? 'wt-pic' : 'wt-art'} viewBox="0 0 80 48" {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': `${city ?? 'Landmark'} illustration` })}><rect width="80" height="48" fill={SKY} />{body}</svg>
}
