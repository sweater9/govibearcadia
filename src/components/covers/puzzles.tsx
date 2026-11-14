import type { ReactNode } from 'react'
import { font, Shadow, type Paint } from './parts'

type Cover = (u: string, f: Paint) => ReactNode

/** Neon Merge: the 2048 board, tiles climbing toward the core. */
const neonMerge: Cover = (u, f) => {
  const s = 22
  const g = 3
  const x0 = 80 - (4 * s + 3 * g) / 2
  const y0 = 9
  const tiles = ['2 4 8 16', '4 32 . 8', '. 64 128 .']
  const tone: Record<string, [string, string]> = { '2': ['#4a5b7c', '#33415c'], '4': ['#5d72a0', '#3f517a'], '8': ['#7aa2ff', '#4a6fe0'], '16': ['#8f86ff', '#5b4fe0'], '32': ['#bb7bff', '#8a43e0'], '64': ['#ff7bd0', '#d03a9e'], '128': ['#ffc95a', '#e08f10'] }
  return <g>
    <Shadow u={u} cx={80} cy={84} rx={56} ry={4} o={0.5} />
    <rect x={x0 - 4} y={y0 - 4} width={4 * s + 3 * g + 8} height={3 * s + 2 * g + 8} rx="8" fill={f('slate')} />
    {tiles.flatMap((row, r) => row.split(' ').map((v, c) => {
      const x = x0 + c * (s + g)
      const y = y0 + r * (s + g)
      if (v === '.') return <rect key={`${r}${c}`} x={x} y={y} width={s} height={s} rx="5" fill="#0c1422" opacity=".8" />
      const [a, b] = tone[v]
      return <g key={`${r}${c}`}>
        {v === '128' ? <rect x={x - 2} y={y - 2} width={s + 4} height={s + 4} rx="7" fill="#ffb02e" opacity=".55" filter={`url(#${u}-glow)`} /> : null}
        <rect x={x} y={y} width={s} height={s} rx="5" fill={b} />
        <rect x={x} y={y} width={s} height={s - 3} rx="5" fill={a} />
        <rect x={x} y={y} width={s} height={s} rx="5" fill={f('gloss')} opacity=".5" />
        <text x={x + s / 2} y={y + s / 2 + (v.length > 2 ? 3 : 4)} textAnchor="middle" fontSize={v.length > 2 ? 9 : v.length > 1 ? 11 : 13} {...font} fill={Number(v) <= 4 ? '#dfe8ff' : '#fff'}>{v}</text>
      </g>
    }))}
  </g>
}

const starPath = (cx: number, cy: number, r: number) => Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5
  const rr = i % 2 ? r * 0.45 : r
  return `${i ? 'L' : 'M'}${cx + Math.cos(a) * rr} ${cy + Math.sin(a) * rr}`
}).join('') + 'Z'
/** A crescent: a disc with a second disc of the background colour biting out of it. */
const Moon = ({ cx, cy, r, fill, bg }: { cx: number; cy: number; r: number; fill: string; bg: string }) => <g><circle cx={cx} cy={cy} r={r} fill={fill} /><circle cx={cx + r * 0.5} cy={cy - r * 0.22} r={r * 0.82} fill={bg} /></g>

/** Memory Grid: face-down cards and a matched pair turned over. */
const memoryGrid: Cover = (u, f) => {
  const w = 24
  const h = 33
  const gap = 5
  const x0 = 80 - (5 * w + 4 * gap) / 2
  const y0 = 9
  const faces: Record<string, string> = { '0,1': 'star', '0,3': 'moon', '1,2': 'star', '1,4': 'moon' }
  return <g>
    <Shadow u={u} cx={80} cy={85} rx={64} ry={4} o={0.5} />
    {Array.from({ length: 10 }, (_, i) => {
      const r = Math.floor(i / 5)
      const c = i % 5
      const x = x0 + c * (w + gap)
      const y = y0 + r * (h + gap + 2)
      const face = faces[`${r},${c}`]
      const cx = x + w / 2
      const cy = y + h / 2
      return <g key={i}>
        <rect x={x + 0.8} y={y + 1.6} width={w} height={h} rx="4" fill="#000" opacity=".4" filter={`url(#${u}-soft)`} />
        {face ? <g>
          {face === 'star' ? <rect x={x - 1.6} y={y - 1.6} width={w + 3.2} height={h + 3.2} rx="5.6" fill="#ffc94a" opacity=".6" filter={`url(#${u}-glow)`} /> : null}
          <rect x={x} y={y} width={w} height={h} rx="4" fill={f('ivory')} />
          {face === 'star' ? <path d={starPath(cx, cy, 8.5)} fill="#f0a800" stroke="#000" strokeOpacity=".2" strokeWidth=".5" /> : <Moon cx={cx - 2} cy={cy} r={8} fill="#5b6ee0" bg="#fffaf0" />}
        </g> : <g>
          <rect x={x} y={y} width={w} height={h} rx="4" fill={f('gold')} />
          <rect x={x + 2.4} y={y + 2.4} width={w - 4.8} height={h - 4.8} rx="2.4" fill="none" stroke="#7a4d00" strokeOpacity=".55" strokeWidth=".8" />
          <path d={`M${cx} ${y + 7} L${x + w - 6} ${cy} L${cx} ${y + h - 7} L${x + 6} ${cy}Z`} fill="#7a4d00" opacity=".4" />
          <rect x={x} y={y} width={w} height={h} rx="4" fill={f('gloss')} opacity=".5" />
        </g>}
      </g>
    })}
  </g>
}

/** Minesweeper: an opened field with numbers, a flag and one mine. */
const minesweeper: Cover = (u) => {
  const s = 15
  const x0 = 20
  const y0 = 7.5
  const map = ['....1###', '...12F##', '..134###', '..1#F#M#', '..12###2']
  const num: Record<string, string> = { '1': '#52a8ff', '2': '#45d493', '3': '#ff6464', '4': '#b583ff' }
  return <g>
    <Shadow u={u} cx={80} cy={84} rx={62} ry={3.4} o={0.5} />
    <rect x={x0 - 3} y={y0 - 3} width={8 * s + 6} height={5 * s + 6} rx="4" fill="#0c1422" />
    {map.flatMap((row, r) => [...row].map((ch, c) => {
      const x = x0 + c * s
      const y = y0 + r * s
      const raised = ch === '#' || ch === 'F'
      return <g key={`${r}${c}`}>
        <rect x={x} y={y} width={s} height={s} fill={raised ? '#aebbd2' : ch === 'M' ? '#7a1f2b' : '#1c2739'} stroke="#0c1422" strokeWidth=".6" />
        {raised ? <g><path d={`M${x} ${y} H${x + s} L${x + s - 2} ${y + 2} H${x + 2} V${y + s - 2} L${x} ${y + s}Z`} fill="#fff" opacity=".75" /><path d={`M${x + s} ${y + s} H${x} L${x + 2} ${y + s - 2} H${x + s - 2} V${y + 2} L${x + s} ${y}Z`} fill="#5b6882" opacity=".85" /></g> : null}
        {num[ch] ? <text x={x + s / 2} y={y + s / 2 + 4} textAnchor="middle" fontSize="11" {...font} fill={num[ch]}>{ch}</text> : null}
        {ch === 'F' ? <g><path d={`M${x + 5} ${y + 3.5} L${x + 11.5} ${y + 6.2} L${x + 5} ${y + 9}Z`} fill="#ef3f4f" /><path d={`M${x + 5} ${y + 3.5} V${y + 12} M${x + 3} ${y + 12} H${x + 9}`} stroke="#10151f" strokeWidth="1.3" strokeLinecap="round" /></g> : null}
        {ch === 'M' ? <g transform={`translate(${x + s / 2} ${y + s / 2})`}><circle r="4" fill="#0b0f16" />{[0, 45, 90, 135].map((a) => <path key={a} d="M-6 0 H6" stroke="#0b0f16" strokeWidth="1.3" strokeLinecap="round" transform={`rotate(${a})`} />)}<circle cx="-1.4" cy="-1.4" r="1.1" fill="#fff" opacity=".8" /></g> : null}
      </g>
    }))}
  </g>
}

/** Color Sort: glass tubes of coloured balls, one lifted out. */
const colorSort: Cover = (u, f) => {
  const tubes: string[][] = [['red', 'blue', 'red', 'yellow'], ['green', 'green', 'purple', 'blue'], ['yellow', 'yellow', 'teal'], ['teal', 'purple', 'red']]
  const x0 = 29
  const pitch = 28
  return <g>
    <Shadow u={u} cx={80} cy={84} rx={60} ry={3.4} o={0.5} />
    {tubes.map((balls, i) => {
      const x = x0 + i * pitch
      return <g key={i}>
        <rect x={x} y="22" width="22" height="62" rx="11" fill="#0c1626" opacity=".85" />
        {balls.map((m, k) => {
          const cy = 77 - k * 14
          return <g key={k}><circle cx={x + 11} cy={cy} r="6.4" fill={f(m)} /><circle cx={x + 11} cy={cy} r="4.2" fill="none" stroke="#fff" strokeOpacity=".25" strokeWidth=".7" /><ellipse cx={x + 8.8} cy={cy - 2.6} rx="2.2" ry="1.3" fill="#fff" opacity=".6" /></g>
        })}
        <rect x={x} y="22" width="22" height="62" rx="11" fill="none" stroke="#bfe1ff" strokeOpacity=".6" strokeWidth="1" />
        <rect x={x + 3} y="28" width="3.2" height="48" rx="1.6" fill="#fff" opacity=".22" />
      </g>
    })}
    <g>
      <circle cx={x0 + 2 * pitch + 11} cy="11" r="6.4" fill="#ffe27a" opacity=".5" filter={`url(#${u}-glow)`} />
      <circle cx={x0 + 2 * pitch + 11} cy="11" r="6.4" fill={f('yellow')} />
      <ellipse cx={x0 + 2 * pitch + 8.8} cy="8.4" rx="2.2" ry="1.3" fill="#fff" opacity=".6" />
    </g>
  </g>
}

/** Daily Word: three guesses in, the last one all green. */
const dailyWord: Cover = (u, f) => {
  const s = 18
  const g = 3.5
  const x0 = 80 - (5 * s + 4 * g) / 2
  const y0 = 15
  const rows: [string, string][] = [['SLATE', 'xyxxy'], ['PEARL', 'gyxxg'], ['PIXEL', 'ggggg']]
  const fill: Record<string, string> = { g: '#3fae6a', y: '#d9a626', x: '#3b4659' }
  return <g>
    <Shadow u={u} cx={80} cy={80} rx={58} ry={3.4} o={0.5} />
    {rows.flatMap(([word, st], r) => [...word].map((ch, c) => {
      const x = x0 + c * (s + g)
      const y = y0 + r * (s + g)
      return <g key={`${r}${c}`}>
        <rect x={x} y={y + 1.2} width={s} height={s} rx="3" fill="#000" opacity=".35" />
        <rect x={x} y={y} width={s} height={s} rx="3" fill={fill[st[c]]} />
        <rect x={x} y={y} width={s} height={s} rx="3" fill={f('gloss')} opacity=".4" />
        <text x={x + s / 2} y={y + s / 2 + 4.6} textAnchor="middle" fontSize="12.5" {...font} fill="#fff">{ch}</text>
      </g>
    }))}
  </g>
}

/** Sudoku Master: a classic grid with givens and a few solved digits. */
const sudoku: Cover = (u) => {
  const s = 8.4
  const x0 = 80 - 4.5 * s
  const y0 = 7
  const rows = ['53..7....', '6..195...', '.98....6.', '8...6...3', '4..8.3..1', '7...2...6', '.6....28.', '...419..5', '....8..79']
  const mine = new Set(['0,2', '0,3', '1,1', '2,0', '4,4', '5,3'])
  const sol: Record<string, string> = { '0,2': '4', '0,3': '6', '1,1': '7', '2,0': '1', '4,4': '5', '5,3': '9' }
  return <g>
    <Shadow u={u} cx={80} cy={85} rx={42} ry={3} o={0.5} />
    <rect x={x0 - 3} y={y0 - 3} width={9 * s + 6} height={9 * s + 6} rx="4" fill="#0d1523" />
    <rect x={x0} y={y0 + 3 * s} width={9 * s} height={s} fill="#6fe0b0" opacity=".1" />
    <rect x={x0 + 4 * s} y={y0} width={s} height={9 * s} fill="#6fe0b0" opacity=".1" />
    <rect x={x0 + 4 * s} y={y0 + 3 * s} width={s} height={s} fill="#6fe0b0" opacity=".38" />
    <g stroke="#8aa0c0" strokeWidth=".4" opacity=".6">{Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${x0 + i * s} ${y0} V${y0 + 9 * s} M${x0} ${y0 + i * s} H${x0 + 9 * s}`} />)}</g>
    <g stroke="#cfe0f5" strokeWidth="1.2">{[0, 3, 6, 9].map((i) => <path key={i} d={`M${x0 + i * s} ${y0} V${y0 + 9 * s} M${x0} ${y0 + i * s} H${x0 + 9 * s}`} />)}</g>
    {rows.flatMap((row, r) => [...row].map((ch, c) => (ch !== '.' || mine.has(`${r},${c}`)
      ? <text key={`${r}${c}`} x={x0 + c * s + s / 2} y={y0 + r * s + s / 2 + 2.6} textAnchor="middle" fontSize="7.4" {...font} fill={mine.has(`${r},${c}`) ? '#6fe0b0' : '#e8f0fb'}>{mine.has(`${r},${c}`) ? sol[`${r},${c}`] : ch}</text>
      : null)))}
  </g>
}

/** Twofold: suns and moons filling a balanced grid. */
const twofold: Cover = (u, f) => {
  const s = 15
  const x0 = 80 - 3 * s
  const y0 = 7.5
  const rows = ['SMSSM.', 'M.MS.S', 'SSM.MM', '.MSMS.', 'MS.SMS']
  return <g>
    <Shadow u={u} cx={80} cy={85} rx={52} ry={3} o={0.5} />
    {rows.flatMap((row, r) => [...row].map((ch, c) => {
      const cx = x0 + c * s + s / 2
      const cy = y0 + r * s + s / 2
      return <g key={`${r}${c}`}>
        <rect x={x0 + c * s + 0.8} y={y0 + r * s + 0.8} width={s - 1.6} height={s - 1.6} rx="3.4" fill={ch === '.' ? '#101a2b' : '#1b2a42'} stroke="#3b5075" strokeWidth=".6" />
        {ch === 'S' ? <g>
          {Array.from({ length: 8 }, (_, k) => <path key={k} d="M0 -6.2 V-4.6" stroke="#ffc94a" strokeWidth="1.1" strokeLinecap="round" transform={`translate(${cx} ${cy}) rotate(${k * 45})`} />)}
          <circle cx={cx} cy={cy} r="3.6" fill={f('yellow')} />
        </g> : null}
        {ch === 'M' ? <Moon cx={cx - 0.8} cy={cy} r={5.2} fill="#b9c8ff" bg="#1b2a42" /> : null}
      </g>
    }))}
  </g>
}

/** Carve: a grid cut into rectangles, each as big as its number. */
const carve: Cover = (u, f) => {
  const s = 12
  const x0 = 80 - 4 * s
  const y0 = 9
  const rects: [number, number, number, number, string, number, boolean][] = [
    [0, 0, 2, 3, 'teal', 6, true], [2, 0, 3, 2, 'purple', 6, true], [5, 0, 3, 1, 'orange', 3, true], [5, 1, 3, 3, 'rose', 9, true],
    [2, 2, 3, 2, 'green', 6, true], [0, 3, 2, 3, 'blue', 6, true], [2, 4, 3, 2, 'yellow', 6, true], [5, 4, 3, 2, 'steel', 6, false],
  ]
  return <g>
    <Shadow u={u} cx={80} cy={85} rx={52} ry={3} o={0.5} />
    <rect x={x0 - 3} y={y0 - 3} width={8 * s + 6} height={6 * s + 6} rx="4" fill="#0d1523" />
    <g stroke="#6a809f" strokeWidth=".4" opacity=".6">{Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${x0 + i * s} ${y0} V${y0 + 6 * s}`} />)}{Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${x0} ${y0 + i * s} H${x0 + 8 * s}`} />)}</g>
    {rects.map(([c, r, w, h, m, n, done]) => <g key={`${c}${r}`}>
      <rect x={x0 + c * s + 0.8} y={y0 + r * s + 0.8} width={w * s - 1.6} height={h * s - 1.6} rx="2.4" fill={done ? f(m) : 'none'} opacity={done ? 0.82 : 1} stroke={done ? '#fff' : '#cfe0f5'} strokeWidth={done ? 1.1 : 1} strokeDasharray={done ? undefined : '3 2'} />
      {done ? <rect x={x0 + c * s + 0.8} y={y0 + r * s + 0.8} width={w * s - 1.6} height={h * s - 1.6} rx="2.4" fill={f('gloss')} opacity=".35" /> : null}
      <text x={x0 + (c + 0.5) * s} y={y0 + (r + 0.5) * s + 3.6} textAnchor="middle" fontSize="10.5" {...font} fill="#fff" stroke="#000" strokeOpacity=".25" strokeWidth=".4">{n}</text>
    </g>)}
  </g>
}

/** VibeLine: one glowing line threading the numbers in order. */
const vibeline: Cover = (u) => {
  const s = 15
  const x0 = 80 - 2.5 * s
  const y0 = 15
  const path: [number, number][] = [[0, 0], [1, 0], [2, 0], [2, 1], [1, 1], [0, 1], [0, 2], [1, 2], [2, 2], [3, 2], [3, 1], [3, 0], [4, 0], [4, 1]]
  const pt = ([c, r]: [number, number]) => [x0 + c * s + s / 2, y0 + r * s + s / 2] as const
  const d = path.map((p, i) => `${i ? 'L' : 'M'}${pt(p)[0]} ${pt(p)[1]}`).join('')
  const visited = new Set(path.map((p) => p.join(',')))
  const nums: [number, number, number][] = [[0, 0, 1], [2, 1, 2], [0, 2, 3], [3, 2, 4], [4, 0, 5], [4, 3, 6]]
  return <g>
    <Shadow u={u} cx={80} cy={80} rx={50} ry={3} o={0.5} />
    <rect x={x0 - 3} y={y0 - 3} width={5 * s + 6} height={4 * s + 6} rx="5" fill="#0d1523" />
    {Array.from({ length: 20 }, (_, i) => {
      const c = i % 5
      const r = Math.floor(i / 5)
      return <rect key={i} x={x0 + c * s + 0.7} y={y0 + r * s + 0.7} width={s - 1.4} height={s - 1.4} rx="3" fill={visited.has(`${c},${r}`) ? '#5b4fe0' : '#16203a'} opacity={visited.has(`${c},${r}`) ? 0.35 : 1} stroke="#34466a" strokeWidth=".5" />
    })}
    <linearGradient id={`${u}-line`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#c28bff" /><stop offset="1" stopColor="#55d9ff" /></linearGradient>
    <path d={d} fill="none" stroke="#8b7bff" strokeOpacity=".7" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${u}-glow)`} />
    <path d={d} fill="none" stroke={`url(#${u}-line)`} strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={pt(path[13])[0]} cy={pt(path[13])[1]} r="4.4" fill="#fff" />
    {nums.map(([c, r, n]) => <g key={n}>
      <circle cx={x0 + c * s + s / 2} cy={y0 + r * s + s / 2} r="5.2" fill={visited.has(`${c},${r}`) ? '#fff' : '#2b3b5e'} />
      <text x={x0 + c * s + s / 2} y={y0 + r * s + s / 2 + 3.2} textAnchor="middle" fontSize="8" {...font} fill={visited.has(`${c},${r}`) ? '#3a2a9a' : '#9fb3d9'}>{n}</text>
    </g>)}
  </g>
}

export const PUZZLE_COVERS: Record<string, Cover> = {
  'neon-merge': neonMerge, 'memory-grid': memoryGrid, minesweeper, 'color-sort': colorSort, 'daily-word': dailyWord,
  'sudoku-master': sudoku, twofold, carve, vibeline,
}
