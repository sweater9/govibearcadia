import type { ReactNode } from 'react'
import { Die, Disc, font, Shadow, type Paint } from './parts'

export type Cover = (u: string, f: Paint) => ReactNode

/** Connect Four: the blue frame with a red diagonal four about to win. */
const connectFour: Cover = (u, f) => {
  const R = 15.2
  const x0 = 34.4
  const y0 = 19
  const rows: string[] = ['.......', '....R..', '..RRY..', '.YRYY..', 'YRYYR..']
  // rows are top to bottom; R = red, Y = yellow
  const win = new Set(['1,4', '2,3', '3,2', '4,1'])
  return <g>
    <rect width="160" height="90" fill="#0a1426" />
    <Shadow u={u} cx={80} cy={88} rx={62} ry={5} o={0.5} />
    <rect x="23" y="7" width="114" height="92" rx="8" fill={f('blue')} />
    <rect x="23" y="7" width="114" height="92" rx="8" fill={f('gloss')} opacity=".6" />
    <rect x="23" y="7" width="114" height="92" rx="8" fill="none" stroke="#0b2a72" strokeWidth="1.2" />
    {rows.flatMap((row, r) => [...row].map((c, col) => {
      const cx = x0 + col * R
      const cy = y0 + r * R
      const isWin = win.has(`${r},${col}`)
      return <g key={`${r}-${col}`}>
        <circle cx={cx} cy={cy} r="6.6" fill="#08122a" />
        <circle cx={cx} cy={cy} r="6.6" fill="none" stroke="#0b2a72" strokeWidth="1.1" />
        {c !== '.' ? <g>
          <circle cx={cx} cy={cy} r="5.8" fill={f(c === 'R' ? 'red' : 'yellow')} />
          <circle cx={cx} cy={cy} r="3.7" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth=".7" />
          <ellipse cx={cx - 1.7} cy={cy - 2.2} rx="2" ry="1.1" fill="#fff" opacity=".55" />
          {isWin ? <circle cx={cx} cy={cy} r="7.4" fill="none" stroke="#fff" strokeWidth="1.1" opacity=".9" /> : null}
        </g> : null}
      </g>
    }))}
    <path d="M34 20 L95 81" stroke="#fff" strokeWidth="1" opacity=".0" />
  </g>
}

/** Tic-Tac-Toe: a slate board, an X line of three struck through. */
const ticTacToe: Cover = (u, f) => {
  const x0 = 50
  const y0 = 12
  const s = 20
  const X = (cx: number, cy: number) => <g key={`x${cx}${cy}`} stroke={f('red')} strokeWidth="4.4" strokeLinecap="round">
    <path d={`M${cx - 5.5} ${cy - 5.5} L${cx + 5.5} ${cy + 5.5} M${cx + 5.5} ${cy - 5.5} L${cx - 5.5} ${cy + 5.5}`} />
  </g>
  const O = (cx: number, cy: number) => <circle key={`o${cx}${cy}`} cx={cx} cy={cy} r="6" fill="none" stroke={f('gold')} strokeWidth="4" />
  const c = (i: number) => x0 + s * i + s / 2
  const r = (i: number) => y0 + s * i + s / 2
  return <g>
    <Shadow u={u} cx={80} cy={80} rx={42} ry={4} o={0.5} />
    <rect x="43" y="5" width="74" height="74" rx="9" fill={f('slate')} />
    <rect x="43" y="5" width="74" height="74" rx="9" fill="none" stroke="#5a708f" strokeOpacity=".55" strokeWidth="1" />
    <g stroke="#9bb4d6" strokeWidth="2" strokeLinecap="round" opacity=".85">
      <path d={`M${x0 + s} ${y0 + 3} V${y0 + 3 * s - 3} M${x0 + 2 * s} ${y0 + 3} V${y0 + 3 * s - 3} M${x0 + 3} ${y0 + s} H${x0 + 3 * s - 3} M${x0 + 3} ${y0 + 2 * s} H${x0 + 3 * s - 3}`} />
    </g>
    {O(c(1), r(0))}{O(c(0), r(2))}{O(c(2), r(1))}
    {X(c(0), r(0))}{X(c(1), r(1))}{X(c(2), r(2))}{X(c(2), r(0))}
    <path d={`M${c(0) - 7} ${r(0) - 7} L${c(2) + 7} ${r(2) + 7}`} stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".85" />
  </g>
}

/** Checkers: a walnut-and-maple board, a king among the reds. */
const checkers: Cover = (u, f) => {
  const s = 14
  const x0 = 24
  const y0 = 3
  const pieces: Record<string, string> = {}
  for (const [r, c] of [[0, 1], [0, 3], [0, 5], [0, 7], [1, 0], [1, 2], [1, 4], [1, 6]]) pieces[`${r},${c}`] = 'ink'
  for (const [r, c] of [[4, 1], [4, 3], [4, 7], [5, 0], [5, 2], [5, 6], [3, 4]]) pieces[`${r},${c}`] = 'red'
  return <g>
    <rect width="160" height="90" fill="#10161f" />
    <Shadow u={u} cx={80} cy={88} rx={60} ry={3} o={0.5} />
    {Array.from({ length: 48 }, (_, i) => {
      const r = Math.floor(i / 8)
      const c = i % 8
      return <rect key={i} x={x0 + c * s} y={y0 + r * s} width={s} height={s} fill={(r + c) % 2 ? f('woodD') : '#efd3a2'} />
    })}
    <rect x={x0} y={y0} width={8 * s} height={6 * s} fill={f('gloss')} opacity=".28" />
    {Object.entries(pieces).map(([k, m]) => {
      const [r, c] = k.split(',').map(Number)
      return <Disc key={k} u={u} f={f} cx={x0 + c * s + s / 2} cy={y0 + r * s + s / 2} r="5.6" m={m} />
    })}
    <g transform={`translate(${x0 + 4 * s + s / 2} ${y0 + 3 * s + s / 2})`} fill={f('gold')} stroke="#7a4d00" strokeWidth=".5">
      <path d="M-3.4 2 L-4 -2.2 L-1.8 -0.3 L0 -3.2 L1.8 -0.3 L4 -2.2 L3.4 2Z" />
    </g>
  </g>
}

/** Battleship: a warship on the grid with hits and misses marked. */
const battleship: Cover = (u, f) => <g>
  <rect width="160" height="90" fill={f('sea')} />
  <g stroke="#bfe6ff" strokeOpacity=".14" strokeWidth=".6">
    {Array.from({ length: 17 }, (_, i) => <path key={`v${i}`} d={`M${i * 10} 0 V90`} />)}
    {Array.from({ length: 10 }, (_, i) => <path key={`h${i}`} d={`M0 ${i * 10} H160`} />)}
  </g>
  <g transform="rotate(-7 80 45)">
    <Shadow u={u} cx={84} cy={60} rx={52} ry={6} o={0.5} />
    <path d="M26 45 C26 38 34 35 44 35 H112 C124 35 136 41 142 45 C136 49 124 55 112 55 H44 C34 55 26 52 26 45Z" fill={f('steel')} />
    <path d="M26 45 C26 38 34 35 44 35 H112 C124 35 136 41 142 45 C136 49 124 55 112 55 H44 C34 55 26 52 26 45Z" fill="none" stroke="#4a5b78" strokeWidth="1" />
    <rect x="40" y="39" width="62" height="12" rx="2" fill="#7d8fae" />
    <rect x="60" y="37.5" width="20" height="15" rx="3" fill="#cfd9ea" stroke="#4a5b78" strokeWidth=".6" />
    <circle cx="48" cy="45" r="4.4" fill="#4e607d" /><circle cx="94" cy="45" r="4.4" fill="#4e607d" /><circle cx="118" cy="45" r="3.4" fill="#4e607d" />
    <path d="M48 45 H34 M94 45 H110 M118 45 H131" stroke="#2a3850" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="66" y="31" width="3" height="8" fill="#2a3850" />
  </g>
  {[[58, 46], [90, 43], [112, 49]].map(([x, y], i) => <g key={i}>
    <circle cx={x} cy={y} r="6" fill="#ff5a4d" opacity=".5" filter={`url(#${u}-glow)`} />
    <circle cx={x} cy={y} r="3.2" fill={f('red')} stroke="#fff" strokeWidth=".7" />
  </g>)}
  {[[30, 22], [48, 70], [106, 26], [128, 66], [76, 78], [18, 60]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="#f4f7fb" stroke="#9ab" strokeWidth=".6" />)}
  <g fill="none" stroke="#e6f6ff" strokeOpacity=".55" strokeWidth=".8"><ellipse cx="130" cy="24" rx="9" ry="4" /><ellipse cx="130" cy="24" rx="15" ry="6.5" strokeOpacity=".3" /></g>
</g>

/** Ghata Bara: the 7x7 board with its crossed castles, four colours at the edge middles, two long dice. */
const ghataBara: Cover = (u, f) => {
  const s = 9
  const x0 = 48.5
  const y0 = 9
  const cell = (c: number, r: number) => [x0 + c * s, y0 + r * s] as const
  const castles: [number, number][] = [[3, 0], [0, 3], [6, 3], [3, 6], [3, 3]]
  const seats: [number, number, string][] = [[3, 0, 'purple'], [6, 3, 'teal'], [3, 6, 'orange'], [0, 3, 'rose']]
  return <g>
    <Shadow u={u} cx={80} cy={79} rx={40} ry={4} o={0.5} />
    <rect x={x0 - 4} y={y0 - 4} width={7 * s + 8} height={7 * s + 8} rx="5" fill={f('woodD')} />
    <rect x={x0} y={y0} width={7 * s} height={7 * s} fill={f('wood')} />
    <rect x={x0} y={y0} width={7 * s} height={7 * s} fill={f('gloss')} opacity=".35" />
    <g stroke="#6e4524" strokeWidth=".7" opacity=".85">
      {Array.from({ length: 8 }, (_, i) => <path key={i} d={`M${x0 + i * s} ${y0} V${y0 + 7 * s} M${x0} ${y0 + i * s} H${x0 + 7 * s}`} />)}
    </g>
    {castles.map(([c, r]) => {
      const [x, y] = cell(c, r)
      return <path key={`${c}${r}`} d={`M${x + 1} ${y + 1} L${x + s - 1} ${y + s - 1} M${x + s - 1} ${y + 1} L${x + 1} ${y + s - 1}`} stroke="#b02a37" strokeWidth="1.2" strokeLinecap="round" />
    })}
    {seats.map(([c, r, m]) => {
      const [x, y] = cell(c, r)
      return <g key={m}><Disc u={u} f={f} cx={x + 3.3} cy={y + 4} r="2.9" m={m} ring={false} /><Disc u={u} f={f} cx={x + 6} cy={y + 5.2} r="2.9" m={m} ring={false} /></g>
    })}
    {[[12, 62, -14, 2], [126, 36, 11, 5]].map(([x, y, rot, n], i) => <g key={i} transform={`rotate(${rot} ${x + 12} ${y + 5})`}>
      <Shadow u={u} cx={x + 13} cy={y + 12} rx="12" o={0.4} />
      <rect x={x} y={y} width="24" height="10" rx="2.4" fill={f('ivory')} stroke="#000" strokeOpacity=".25" strokeWidth=".5" />
      {Array.from({ length: n }, (_, k) => <circle key={k} cx={x + 4 + k * (16 / Math.max(1, n - 1 || 1)) + (n === 1 ? 8 : 0)} cy={y + 5} r="1.4" fill="#1b2230" />)}
    </g>)}
  </g>
}

/** Aadu Puli Attam: the triangle board, three tigers hunting a herd of goats. */
const aaduPuli: Cover = (u, f) => {
  const apex = [80, 11] as const
  const bx = [30, 55, 80, 105, 130]
  const at = (y: number) => bx.map((b) => apex[0] + (b - apex[0]) * ((y - apex[1]) / 69))
  const lv = [36, 58, 80]
  return <g>
    <Shadow u={u} cx={80} cy={86} rx={58} ry={3} o={0.5} />
    <rect x="16" y="3" width="128" height="82" rx="8" fill={f('wood')} />
    <rect x="16" y="3" width="128" height="82" rx="8" fill={f('gloss')} opacity=".35" />
    <g stroke="#5a361c" strokeWidth="1.5" strokeLinecap="round">
      {bx.map((b) => <path key={b} d={`M${apex[0]} ${apex[1]} L${b} 80`} />)}
      {lv.map((y) => <path key={y} d={`M${at(y)[0]} ${y} H${at(y)[4]}`} />)}
    </g>
    {lv.flatMap((y) => at(y).map((x, i) => <circle key={`${y}-${i}`} cx={x} cy={y} r="1.5" fill="#5a361c" />))}
    {[at(80)[0], at(80)[1], at(80)[3], at(80)[4], at(58)[0], at(58)[2], at(58)[4], at(36)[1], at(36)[3]].map((x, i) => {
      const y = i < 4 ? 80 : i < 7 ? 58 : 36
      return <Disc key={i} u={u} f={f} cx={x} cy={y} r="4.4" m="ivory" />
    })}
    {[[apex[0], apex[1]], [at(36)[1], 36], [at(58)[3], 58]].map(([x, y], i) => <g key={i}>
      <Disc u={u} f={f} cx={x} cy={y} r="5.4" m="orange" ring={false} />
      <path d={`M${x - 3.6} ${y - 2.4} L${x - 1.2} ${y - 1} M${x + 3.6} ${y - 2.4} L${x + 1.2} ${y - 1} M${x - 3.4} ${y + 2.2} L${x - 1.1} ${y + 1} M${x + 3.4} ${y + 2.2} L${x + 1.1} ${y + 1}`} stroke="#3a1c04" strokeWidth="1.2" strokeLinecap="round" />
    </g>)}
  </g>
}

/** Pallanguzhi: the carved wooden board, two rows of seven pits, seeds in each. */
const pallanguzhi: Cover = (u, f) => {
  const seeds = [4, 3, 5, 4, 2, 4, 3, 4, 5, 3, 4, 2, 4, 3]
  const tone = ['#f2e4c4', '#e9d3a0', '#c99a62', '#a8703a']
  return <g>
    <Shadow u={u} cx={80} cy={80} rx={66} ry={4} o={0.55} />
    <rect x="8" y="14" width="144" height="62" rx="12" fill={f('woodD')} />
    <rect x="11" y="17" width="138" height="56" rx="10" fill={f('wood')} />
    <rect x="11" y="17" width="138" height="56" rx="10" fill={f('gloss')} opacity=".4" />
    {[14, 146].flatMap((x) => [24, 66].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" fill={f('gold')} />))}
    {Array.from({ length: 14 }, (_, i) => {
      const col = i % 7
      const row = Math.floor(i / 7)
      const cx = 29 + col * 17
      const cy = 33 + row * 25
      return <g key={i}>
        <circle cx={cx} cy={cy + 0.8} r="8.2" fill="#fff" opacity=".35" />
        <circle cx={cx} cy={cy} r="7.8" fill="#3a2212" />
        <circle cx={cx} cy={cy + 1} r="6.4" fill="#5a381d" />
        {Array.from({ length: seeds[i] }, (_, k) => {
          const a = (k / seeds[i]) * Math.PI * 2 + i
          const rr = seeds[i] === 1 ? 0 : 2.6
          return <circle key={k} cx={cx + Math.cos(a) * rr} cy={cy + 0.6 + Math.sin(a) * rr} r="2" fill={tone[(k + i) % 4]} stroke="#000" strokeOpacity=".25" strokeWidth=".4" />
        })}
      </g>
    })}
  </g>
}

/** Carrom: top-down board with coins around the queen and a striker lined up. */
const carrom: Cover = (u, f) => {
  const x0 = 40
  const y0 = 4
  const s = 80
  const cx = x0 + s / 2
  const cy = y0 + s / 2
  const ring = Array.from({ length: 6 }, (_, k) => [cx + Math.cos((k / 6) * Math.PI * 2) * 8.4, cy + Math.sin((k / 6) * Math.PI * 2) * 8.4, k % 2 ? 'ink' : 'ivory'] as const)
  const outer = Array.from({ length: 6 }, (_, k) => [cx + Math.cos(((k + 0.5) / 6) * Math.PI * 2) * 15.5, cy + Math.sin(((k + 0.5) / 6) * Math.PI * 2) * 15.5, k % 2 ? 'ivory' : 'ink'] as const)
  return <g>
    <rect width="160" height="90" fill="#0f1620" />
    <Shadow u={u} cx={80} cy={86} rx={44} ry={3} o={0.5} />
    <rect x={x0} y={y0} width={s} height={s} rx="4" fill={f('woodD')} />
    <rect x={x0 + 5} y={y0 + 5} width={s - 10} height={s - 10} rx="2" fill="#f2d9a8" />
    <rect x={x0 + 5} y={y0 + 5} width={s - 10} height={s - 10} rx="2" fill={f('gloss')} opacity=".3" />
    {[[x0 + 8, y0 + 8], [x0 + s - 8, y0 + 8], [x0 + 8, y0 + s - 8], [x0 + s - 8, y0 + s - 8]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="5.2" fill="#0b0f16" /><circle cx={x} cy={y} r="5.2" fill="none" stroke="#c9a15c" strokeWidth=".8" /></g>)}
    <g fill="none" stroke="#9c6b3a" strokeWidth=".7" opacity=".9">
      <circle cx={cx} cy={cy} r="20" /><circle cx={cx} cy={cy} r="4.4" fill="#b02a37" stroke="none" />
      <rect x={x0 + 17} y={y0 + s - 20} width={s - 34} height="6" rx="3" />
      <path d={`M${x0 + 15} ${y0 + 15} L${x0 + 27} ${y0 + 27} M${x0 + s - 15} ${y0 + 15} L${x0 + s - 27} ${y0 + 27}`} />
    </g>
    {[...ring, ...outer].map(([x, y, m], i) => <Disc key={i} u={u} f={f} cx={x} cy={y} r="3.3" m={m} ring />)}
    <Disc u={u} f={f} cx={cx} cy={cy} r="3.4" m="red" />
    <path d={`M${cx + 8} ${y0 + s - 17} L${cx + 26} ${y0 + s - 32}`} stroke="#fff" strokeWidth="1" strokeDasharray="2 2.4" opacity=".7" />
    <circle cx={cx + 7} cy={y0 + s - 17} r="5.6" fill={f('ivory')} stroke="#c98c10" strokeWidth="1.6" />
    <circle cx={cx + 7} cy={y0 + s - 17} r="2.4" fill="none" stroke="#c98c10" strokeWidth=".8" />
  </g>
}

/** Ludo: four coloured yards round the cross track, two pawns and a die. */
const ludo: Cover = (u, f) => {
  const x0 = 38
  const y0 = 5
  const s = 80
  const q = 32
  const yard = (x: number, y: number, m: string) => <g key={m}>
    <rect x={x} y={y} width={q} height={q} fill={f(m)} />
    <rect x={x + 5} y={y + 5} width={q - 10} height={q - 10} rx="4" fill="#fff" opacity=".9" />
    {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => <circle key={`${a}${b}`} cx={x + 11 + a * 10} cy={y + 11 + b * 10} r="3.6" fill={f(m)} stroke="#000" strokeOpacity=".25" strokeWidth=".5" />)}
  </g>
  const cx = x0 + s / 2
  const cy = y0 + s / 2
  const t = (s - 2 * q) / 3
  return <g>
    <Shadow u={u} cx={78} cy={86} rx={46} ry={3} o={0.5} />
    <rect x={x0 - 2.5} y={y0 - 2.5} width={s + 5} height={s + 5} rx="5" fill="#1b2230" />
    <rect x={x0} y={y0} width={s} height={s} fill="#fbf6ea" />
    {yard(x0, y0, 'red')}{yard(x0 + s - q, y0, 'green')}{yard(x0, y0 + s - q, 'blue')}{yard(x0 + s - q, y0 + s - q, 'yellow')}
    <g stroke="#b8aa8a" strokeWidth=".5">
      {Array.from({ length: 4 }, (_, i) => <path key={i} d={`M${x0 + q + i * t} ${y0} V${y0 + s} M${x0} ${y0 + q + i * t} H${x0 + s}`} />)}
    </g>
    {Array.from({ length: 5 }, (_, i) => <g key={i}>
      <rect x={cx - t / 2 + 0.3} y={y0 + (i + 1) * (q / 6.4)} width={t - 0.6} height={q / 6.4 - 0.4} fill={f('red')} opacity=".85" />
      <rect x={x0 + s - (i + 1) * (q / 6.4) - q / 6.4 + 0.4} y={cy - t / 2 + 0.3} width={q / 6.4 - 0.4} height={t - 0.6} fill={f('green')} opacity=".85" />
    </g>)}
    <path d={`M${x0 + q} ${y0 + q} L${cx} ${cy} L${x0 + q + t} ${y0 + q} Z`} fill={f('red')} />
    <path d={`M${x0 + q + t} ${y0 + q} L${cx} ${cy} L${x0 + q + t} ${y0 + q + t} Z`} fill={f('green')} />
    <path d={`M${x0 + q + t} ${y0 + q + t} L${cx} ${cy} L${x0 + q} ${y0 + q + t} Z`} fill={f('yellow')} />
    <path d={`M${x0 + q} ${y0 + q + t} L${cx} ${cy} L${x0 + q} ${y0 + q} Z`} fill={f('blue')} />
    {[[cx - 18, y0 + q - 5, 'red'], [cx + 9, cy + 12, 'yellow'], [x0 + q - 6, cy + 14, 'blue']].map(([x, y, m]) => <g key={`${x}${y}`}>
      <Shadow u={u} cx={Number(x) + 1} cy={Number(y) + 6} rx="4.6" o={0.5} />
      <path d={`M${Number(x) - 4} ${Number(y) + 6} Q${Number(x) - 3} ${Number(y) - 1} ${Number(x)} ${Number(y) - 2} Q${Number(x) + 3} ${Number(y) - 1} ${Number(x) + 4} ${Number(y) + 6}Z`} fill={f(String(m))} stroke="#000" strokeOpacity=".3" strokeWidth=".5" />
      <circle cx={x} cy={Number(y) - 3.4} r="3" fill={f(String(m))} stroke="#000" strokeOpacity=".3" strokeWidth=".5" />
      <ellipse cx={Number(x) - 1} cy={Number(y) - 4.4} rx="1.1" ry=".7" fill="#fff" opacity=".7" />
    </g>)}
    <Die u={u} x={122} y={56} s={15} n={5} rot={14} />
  </g>
}

/** World Trip: the ring of city tiles, a title deed, a pawn and the dice. */
const worldTrip: Cover = (u, f) => {
  const x0 = 26
  const y0 = 10
  const t = 6.2
  const pal = ['#8e5bd8', '#3a7be0', '#1fb3a4', '#3fae5e', '#e3b230', '#e8763a', '#d8435c']
  const tile = (x: number, y: number, k: number) => <g key={`${x}-${y}`}>
    <rect x={x} y={y} width={t - 0.5} height={t - 0.5} fill="#f6efdc" />
    <rect x={x} y={y} width={t - 0.5} height={2} fill={pal[k % pal.length]} />
  </g>
  const ring: ReactNode[] = []
  for (let i = 0; i < 11; i++) {
    ring.push(tile(x0 + i * t, y0, i), tile(x0 + i * t, y0 + 10 * t, i + 3))
    if (i > 0 && i < 10) ring.push(tile(x0, y0 + i * t, i + 1), tile(x0 + 10 * t, y0 + i * t, i + 5))
  }
  const cx = x0 + 5.5 * t
  const cy = y0 + 5.5 * t
  return <g>
    <Shadow u={u} cx={cx + 2} cy={y0 + 11 * t + 2} rx={36} ry={3.4} o={0.5} />
    <rect x={x0 - 3} y={y0 - 3} width={11 * t + 6} height={11 * t + 6} rx="4" fill="#0e1828" />
    <rect x={x0 + t} y={y0 + t} width={9 * t - 0.5} height={9 * t - 0.5} fill={f('feltN')} />
    {ring}
    <g transform={`translate(${cx} ${cy})`}>
      <circle r="18" fill="none" stroke="#c9a15c" strokeOpacity=".5" strokeWidth=".7" strokeDasharray="2 2" />
      <path d="M0 -20 L3 -3 L20 0 L3 3 L0 20 L-3 3 L-20 0 L-3 -3Z" fill={f('gold')} opacity=".85" />
      <path d="M0 -9 L-4 0 H4Z" fill="#c8283c" />
    </g>
    <Disc u={u} f={f} cx={x0 + 3 * t + 3} cy={y0 + 10 * t + 3} r="2.8" m="purple" ring={false} />
    <Disc u={u} f={f} cx={x0 + 9 * t + 3} cy={y0 + 3} r="2.8" m="teal" ring={false} />
    <g transform="rotate(7 124 44)">
      <rect x="107.8" y="21.6" width="34" height="46" rx="3.4" fill="#000" opacity=".4" filter={`url(#${u}-soft)`} />
      <rect x="106" y="20" width="34" height="46" rx="3.4" fill={f('ivory')} />
      <rect x="106" y="20" width="34" height="12" rx="3.4" fill="#e8763a" />
      <rect x="106" y="27" width="34" height="5" fill="#e8763a" />
      <text x="109.5" y="29" fontSize="4.5" {...font} fill="#fff">San Francisco</text>
      {[38, 44, 50].map((y) => <g key={y}><rect x="110" y={y} width="16" height="2" rx="1" fill="#3a2f22" opacity=".7" /><rect x="130" y={y} width="6" height="2" rx="1" fill="#3a2f22" opacity=".7" /></g>)}
      <rect x="110" y="57" width="26" height="2.4" rx="1.2" fill="#c8283c" opacity=".8" />
    </g>
    <Die u={u} x={118} y={62} s={13} n={4} rot={-12} />
    <Die u={u} x={133} y={67} s={13} n={3} rot={16} />
  </g>
}

/** Taiwanese Mahjong: a wall of tiles behind a hand of ivory tiles. */
const mahjong: Cover = (u, f) => {
  const tileFace = (x: number, y: number, w: number, h: number, body: ReactNode, key: string) => <g key={key}>
    <rect x={x + 1.2} y={y + 2.4} width={w} height={h} rx="2.6" fill="#0f6b4b" />
    <rect x={x + 0.4} y={y + 3.6} width={w} height={h} rx="2.6" fill="#000" opacity=".35" filter={`url(#${u}-soft)`} />
    <rect x={x} y={y} width={w} height={h} rx="2.6" fill={f('ivory')} stroke="#000" strokeOpacity=".25" strokeWidth=".5" />
    {body}
  </g>
  const cx = (x: number, w: number) => x + w / 2
  const W = 22
  const H = 30
  const y = 46
  const dots = (x: number) => [[0, -7, '#1f8a5a'], [-6, 0, '#c8283c'], [6, 0, '#2457d6'], [0, 7, '#1f8a5a']].map(([a, b, c], i) => <g key={i}><circle cx={cx(x, W) + Number(a)} cy={y + H / 2 + Number(b)} r="3.5" fill={String(c)} /><circle cx={cx(x, W) + Number(a)} cy={y + H / 2 + Number(b)} r="1.4" fill="#fff" opacity=".8" /></g>)
  const bamboo = (x: number) => [-6, 0, 6].map((d, i) => <g key={i}><rect x={cx(x, W) + d - 1.8} y={y + 5} width="3.6" height="20" rx="1.8" fill={i === 1 ? '#c8283c' : '#1f8a5a'} /><path d={`M${cx(x, W) + d - 1.8} ${y + 12} h3.6 M${cx(x, W) + d - 1.8} ${y + 18} h3.6`} stroke="#fff" strokeOpacity=".7" strokeWidth=".6" /></g>)
  const dragon = (x: number) => <g stroke="#c8283c" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x={cx(x, W) - 6.5} y={y + 8} width="13" height="12" rx="1" /><path d={`M${cx(x, W)} ${y + 4} V${y + 26}`} /></g>
  const flower = (x: number) => <g transform={`translate(${cx(x, W)} ${y + H / 2})`}>
    {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-5.2" rx="3.4" ry="5" fill="#f06d8d" transform={`rotate(${a})`} />)}
    <circle r="2.6" fill="#ffd24a" />
  </g>
  const bigDot = (x: number) => <g><circle cx={cx(x, W)} cy={y + H / 2} r="9" fill="#c8283c" /><circle cx={cx(x, W)} cy={y + H / 2} r="5.6" fill="#fff" /><circle cx={cx(x, W)} cy={y + H / 2} r="2.6" fill="#1f8a5a" /></g>
  return <g>
    <rect width="160" height="90" fill="#0f3a2c" />
    <rect width="160" height="90" fill={f('felt')} opacity=".75" />
    {Array.from({ length: 9 }, (_, i) => <g key={i}>
      <rect x={10 + i * 16.4 + 1} y={14 + 2} width="14" height="20" rx="2.2" fill="#0a4d37" />
      <rect x={10 + i * 16.4} y="14" width="14" height="20" rx="2.2" fill="#14825b" stroke="#000" strokeOpacity=".3" strokeWidth=".5" />
      <rect x={10 + i * 16.4 + 2.2} y="16.2" width="9.6" height="15.6" rx="1.4" fill="none" stroke="#fff" strokeOpacity=".28" strokeWidth=".6" />
    </g>)}
    {tileFace(12, y, W, H, dots(12), 'a')}
    {tileFace(37, y, W, H, bamboo(37), 'b')}
    {tileFace(62, y, W, H, dragon(62), 'c')}
    {tileFace(87, y, W, H, flower(87), 'd')}
    {tileFace(112, y, W, H, bigDot(112), 'e')}
  </g>
}

export const BOARD_COVERS: Record<string, Cover> = {
  'connect-four': connectFour, 'tic-tac-toe': ticTacToe, checkers, battleship, 'ghata-bara': ghataBara, 'aadu-puli-attam': aaduPuli,
  pallanguzhi, carrom, ludo, 'world-trip': worldTrip, 'taiwanese-mahjong': mahjong,
}
