/* eslint-disable react-refresh/only-export-components -- a table of SVG drawings, not a hot-reloaded component module */
import type { ReactNode } from 'react'
import { font, Shadow, type Paint } from './parts'

type Cover = (u: string, f: Paint) => ReactNode

/** Pulse Tap: ripples spreading from the target, a thirty-second ring running down. */
const pulseTap: Cover = (u) => {
  const arc = (r: number, a0: number, a1: number) => {
    const p = (a: number) => [80 + Math.cos(a) * r, 45 + Math.sin(a) * r]
    const [x0, y0] = p(a0)
    const [x1, y1] = p(a1)
    return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`
  }
  return <g>
    <rect width="160" height="90" fill="#25101a" />
    {[40, 30, 20].map((r, i) => <circle key={r} cx="80" cy="45" r={r} fill="none" stroke="#ff5a76" strokeOpacity={0.2 + i * 0.22} strokeWidth={2.4 - i * 0.4} />)}
    <circle cx="80" cy="45" r="44" fill="none" stroke="#fff" strokeOpacity=".1" strokeWidth="3" />
    <path d={arc(44, -Math.PI / 2, Math.PI * 1.15)} fill="none" stroke="#ffc94a" strokeWidth="3" strokeLinecap="round" />
    <circle cx="80" cy="45" r="14" fill="#ff4d6d" opacity=".55" filter={`url(#${u}-glow)`} />
    <circle cx="80" cy="45" r="9.4" fill="#ff4d6d" />
    <circle cx="80" cy="45" r="9.4" fill="none" stroke="#fff" strokeWidth="1.2" />
    <circle cx="80" cy="45" r="3.4" fill="#fff" />
    <g stroke="#fff" strokeOpacity=".65" strokeWidth="1.1" strokeLinecap="round"><path d="M80 29 V34 M80 56 V61 M64 45 H69 M91 45 H96" /></g>
    {[[34, 18], [128, 26], [26, 70], [136, 66], [112, 12]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.1" fill="#ffd6df" opacity=".6" />)}
  </g>
}

/** Neon Snake: a long violet trail curling toward a glowing signal. */
const neonSnake: Cover = (u) => {
  const d = 'M16 70 H58 Q68 70 68 60 V44 Q68 34 78 34 H100 Q110 34 110 44 V56 Q110 62 116 62 H124'
  return <g>
    <rect width="160" height="90" fill="#171229" />
    <g fill="#6a5aa8" opacity=".28">{Array.from({ length: 8 * 14 }, (_, i) => <circle key={i} cx={10 + (i % 14) * 10.5} cy={8 + Math.floor(i / 14) * 10.5} r=".8" />)}</g>
    <path d={d} fill="none" stroke="#9a6bff" strokeOpacity=".7" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${u}-glow)`} />
    <path d={d} fill="none" stroke="#7a4bf0" strokeWidth="9.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d={d} fill="none" stroke="#c9a8ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 7.4" />
    <path d={d} fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" transform="translate(0 -2.6)" />
    <g transform="translate(124 62)">
      <circle r="6.6" fill="#8b5cf6" stroke="#d9c4ff" strokeWidth=".8" />
      <circle cx="1.6" cy="-2.6" r="1.8" fill="#fff" /><circle cx="1.6" cy="2.6" r="1.8" fill="#fff" />
      <circle cx="2.1" cy="-2.6" r=".8" fill="#1b1230" /><circle cx="2.1" cy="2.6" r=".8" fill="#1b1230" />
    </g>
    <circle cx="140" cy="62" r="9" fill="#ffb02e" opacity=".5" filter={`url(#${u}-glow)`} />
    <circle cx="140" cy="62" r="4.6" fill="#ffc94a" stroke="#fff" strokeWidth=".8" />
    <ellipse cx="138.6" cy="60.4" rx="1.4" ry=".9" fill="#fff" />
  </g>
}

/** Brick Breaker: a wall with a gap, the ball streaking in off the paddle. */
const brickBreaker: Cover = (u, f) => {
  const cols = ['rose', 'orange', 'yellow', 'green']
  const w = 22
  const h = 9
  return <g>
    <rect width="160" height="90" fill="#1d1020" />
    {Array.from({ length: 4 * 6 }, (_, i) => {
      const r = Math.floor(i / 6)
      const c = i % 6
      if (r === 2 && c === 3) return null
      const x = 12 + c * (w + 2)
      const y = 8 + r * (h + 2)
      return <g key={i}>
        <rect x={x} y={y + 1} width={w} height={h} rx="2" fill="#000" opacity=".35" />
        <rect x={x} y={y} width={w} height={h} rx="2" fill={f(cols[r])} />
        <rect x={x} y={y} width={w} height={h} rx="2" fill={f('gloss')} opacity=".7" />
      </g>
    })}
    {[[76, 36, 1.6], [84, 38, 1.2], [80, 33, 1], [88, 34, 1.3]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#ffd36a" opacity=".85" />)}
    {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={100 + i * 5.4} cy={72 - i * 5.8} r={5.2 - i * 0.7} fill="#fff" opacity={0.08 + i * 0.07} />)}
    <circle cx="94" cy="76" r="5.6" fill="#fff" opacity=".35" filter={`url(#${u}-glow)`} />
    <circle cx="94" cy="76" r="4.4" fill={f('ivory')} stroke="#000" strokeOpacity=".2" strokeWidth=".5" />
    <Shadow u={u} cx={82} cy={87} rx={26} ry={3} o={0.45} />
    <rect x="58" y="80" width="44" height="7" rx="3.5" fill={f('teal')} />
    <rect x="58" y="80" width="44" height="7" rx="3.5" fill={f('gloss')} opacity=".7" />
    <rect x="58" y="80" width="10" height="7" rx="3.5" fill="#ff5a76" opacity=".9" /><rect x="92" y="80" width="10" height="7" rx="3.5" fill="#ff5a76" opacity=".9" />
  </g>
}

/** Neon Pong: two paddles, a streaking ball and the score above the net. */
const neonPong: Cover = (u, f) => <g>
  <rect width="160" height="90" fill="#20111f" />
  <path d="M80 4 V86" stroke="#fff" strokeOpacity=".3" strokeWidth="1.6" strokeDasharray="5 5" />
  <text x="62" y="30" textAnchor="middle" fontSize="22" {...font} fill="#fff" opacity=".16">3</text>
  <text x="98" y="30" textAnchor="middle" fontSize="22" {...font} fill="#fff" opacity=".16">5</text>
  <rect x="16" y="22" width="7" height="32" rx="3.5" fill="#35e0f0" opacity=".5" filter={`url(#${u}-glow)`} />
  <rect x="16" y="22" width="7" height="32" rx="3.5" fill={f('teal')} />
  <rect x="16" y="22" width="7" height="32" rx="3.5" fill={f('gloss')} opacity=".7" />
  <rect x="137" y="40" width="7" height="32" rx="3.5" fill="#ff5a76" opacity=".5" filter={`url(#${u}-glow)`} />
  <rect x="137" y="40" width="7" height="32" rx="3.5" fill={f('rose')} />
  <rect x="137" y="40" width="7" height="32" rx="3.5" fill={f('gloss')} opacity=".7" />
  {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={104 - i * 8} cy={58 + i * 1.8} r={4.6 - i * 0.6} fill="#fff" opacity={0.5 - i * 0.07} />)}
  <circle cx="108" cy="57" r="8" fill="#fff" opacity=".4" filter={`url(#${u}-glow)`} />
  <circle cx="108" cy="57" r="5" fill="#fff" />
</g>

const ALIEN_A = ['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...']
const ALIEN_B = ['...####...', '.########.', '##########', '###..##..#', '##########', '..##..##..', '.##.##.##.', '##......##']

function Pixels({ rows, x, y, s, fill }: { rows: string[]; x: number; y: number; s: number; fill: string }) {
  return <g fill={fill}>{rows.flatMap((row, r) => [...row].map((ch, c) => (ch === '#' ? <rect key={`${r}${c}`} x={x + c * s} y={y + r * s} width={s + 0.05} height={s + 0.05} /> : null)))}</g>
}

/** Space Defender: a wave of invaders, one hit, and the cannon firing from behind the shields. */
const spaceDefender: Cover = (u, f) => {
  const cols = ['#ff6b8a', '#ffb04d', '#7be0a6']
  return <g>
    <rect width="160" height="90" fill="#0d1224" />
    <g fill="#fff">{Array.from({ length: 28 }, (_, i) => <circle key={i} cx={(i * 47) % 156 + 2} cy={(i * 29) % 70 + 2} r={i % 5 === 0 ? 1 : 0.6} opacity={0.25 + (i % 4) * 0.12} />)}</g>
    {[0, 1, 2].flatMap((r) => [0, 1, 2, 3, 4].map((c) => {
      const x = 20 + c * 25 + (r === 1 ? 0 : 1)
      const y = 6 + r * 15.5
      if (r === 1 && c === 2) return null
      return <g key={`${r}${c}`}>
        <Pixels rows={r === 1 ? ALIEN_B : ALIEN_A} x={x} y={y} s={r === 1 ? 1.9 : 1.6} fill={cols[r]} />
      </g>
    }))}
    <g transform="translate(80 29)">
      {Array.from({ length: 8 }, (_, i) => <path key={i} d="M0 -6 V-11" stroke="#ffd36a" strokeWidth="1.8" strokeLinecap="round" transform={`rotate(${i * 45})`} />)}
      <circle r="5" fill="#fff6c8" />
    </g>
    <path d="M80 64 V38" stroke="#7fe3ff" strokeWidth="2" strokeLinecap="round" />
    <path d="M80 64 V38" stroke="#7fe3ff" strokeOpacity=".5" strokeWidth="6" strokeLinecap="round" filter={`url(#${u}-glow)`} />
    {[24, 62, 98, 136].map((x) => <path key={x} d={`M${x - 11} 68 V60 Q${x - 11} 54 ${x - 5} 54 H${x + 5} Q${x + 11} 54 ${x + 11} 60 V68 H${x + 5} V63 H${x - 5} V68Z`} fill="#3fae6a" opacity={x === 62 ? 0.5 : 0.85} />)}
    <Shadow u={u} cx={80} cy={86} rx={14} ry={2} o={0.5} />
    <path d="M80 66 L92 83 H68Z" fill={f('steel')} />
    <path d="M80 66 L86 83 H74Z" fill="#fff" opacity=".35" />
    <rect x="76" y="76" width="8" height="5" rx="2" fill="#4cc9f0" />
  </g>
}

/** Gravity Flip: the cube standing on the ceiling, its ghost on the floor, the exit glowing ahead. */
const gravityFlip: Cover = (u, f) => <g>
  <rect width="160" height="90" fill="#141a38" />
  <rect x="0" y="0" width="160" height="14" fill="#2a3470" />
  <rect x="0" y="14" width="160" height="2.4" fill="#7f95ff" />
  <rect x="0" y="76" width="160" height="14" fill="#2a3470" />
  <rect x="0" y="73.6" width="160" height="2.4" fill="#7f95ff" />
  {Array.from({ length: 9 }, (_, i) => <g key={i} stroke="#4a5cc0" strokeWidth=".8"><path d={`M${i * 20 + 6} 0 V14 M${i * 20 + 6} 76 V90`} /></g>)}
  {[46, 56, 66].map((x) => <path key={x} d={`M${x} 73.6 L${x + 5} 62 L${x + 10} 73.6Z`} fill="#ff6b8a" />)}
  <g opacity=".4" transform="translate(30 0)">
    <rect x="0" y="55" width="18" height="18" rx="4" fill="none" stroke="#9fe8ff" strokeWidth="1.4" strokeDasharray="3 2" />
  </g>
  <path d="M42 54 C56 40 56 38 52 30" fill="none" stroke="#ffc94a" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 3" />
  <path d="M52 30 l-5 1 m5 -1 l1 5" stroke="#ffc94a" strokeWidth="2" strokeLinecap="round" />
  <g transform="translate(30 16.4)">
    <Shadow u={u} cx={9} cy={20} rx={9} ry={1.6} o={0.4} />
    <rect width="18" height="18" rx="4" fill={f('teal')} />
    <rect width="18" height="18" rx="4" fill={f('gloss')} opacity=".6" transform="scale(1 -1) translate(0 -18)" />
    <circle cx="5.8" cy="11.5" r="2.2" fill="#10202c" /><circle cx="12.2" cy="11.5" r="2.2" fill="#10202c" />
    <circle cx="6.4" cy="12" r=".8" fill="#fff" /><circle cx="12.8" cy="12" r=".8" fill="#fff" />
  </g>
  <g transform="translate(130 56)">
    <ellipse cx="0" cy="0" rx="9" ry="14" fill="#a56bff" opacity=".55" filter={`url(#${u}-glow)`} />
    <ellipse cx="0" cy="0" rx="8" ry="13" fill="none" stroke="#d9c0ff" strokeWidth="2" />
    <ellipse cx="0" cy="0" rx="4.6" ry="8" fill="#6b3dd0" />
    <ellipse cx="0" cy="0" rx="2" ry="4" fill="#fff" opacity=".8" />
  </g>
</g>

/** Traffic Dodger: a night road, three lanes of tail-lights and the player's car squeezing between them. */
const trafficDodger: Cover = (u, f) => {
  const car = (x: number, y: number, c: string, key: string) => <g key={key}>
    <rect x={x} y={y} width="16" height="26" rx="5" fill={c} />
    <rect x={x + 3} y={y + 6} width="10" height="8" rx="2" fill="#0a121c" opacity=".75" />
    <rect x={x + 2} y={y + 22} width="3.4" height="2.2" fill="#ff4d4d" /><rect x={x + 10.6} y={y + 22} width="3.4" height="2.2" fill="#ff4d4d" />
  </g>
  return <g>
    <rect width="160" height="90" fill="#0f1622" />
    <rect x="30" width="100" height="90" fill="#18222f" />
    {[55, 80, 105].map((x) => <path key={x} d={`M${x} 0V90`} stroke="#7fd8ff" strokeOpacity=".55" strokeWidth="1.2" strokeDasharray="7 6" />)}
    {car(36, 8, '#ff7a59', 'a')}{car(86, 18, '#ffd166', 'b')}{car(110, -4, '#9b8cff', 'c')}{car(36, 52, '#5eead4', 'd')}
    <rect x="73" y="50" width="16" height="30" rx="5" fill={f('teal')} />
    <rect x="76" y="58" width="10" height="9" rx="2" fill="#0a121c" opacity=".75" />
    <ellipse cx="81" cy="84" rx="11" ry="3" fill="#000" opacity=".35" filter={`url(#${u}-soft)`} />
  </g>
}

/** Stack Tower: a tower of colourful slabs, a sliding block above and a trimmed sliver falling away. */
const stackTower: Cover = () => <g>
  <rect width="160" height="90" fill="#0f1a2e" />
  {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={50 + (i % 3) * 3} y={76 - i * 11} width={60 - i * 3} height="10" rx="2" fill={`hsl(${200 + i * 22} 80% 60%)`} />)}
  <rect x="82" y="3" width="42" height="10" rx="2" fill="hsl(330 80% 66%)" opacity=".95" />
  <rect x="124" y="30" width="8" height="10" rx="2" fill="hsl(300 70% 60%)" opacity=".6" transform="rotate(18 128 35)" />
</g>

/** Lane Hopper: a frog about to cross a night road between two cars, with grass verges. */
const laneHopper: Cover = (u, f) => <g>
  <rect width="160" height="90" fill="#17382c" />
  <rect y="22" width="160" height="46" fill="#1c2633" />
  <path d="M0 45H160" stroke="#7fd8ff" strokeOpacity=".5" strokeWidth="1.2" strokeDasharray="7 6" />
  <rect x="14" y="27" width="34" height="14" rx="5" fill="#ff7a59" /><rect x="104" y="27" width="34" height="14" rx="5" fill="#ffd166" />
  <rect x="58" y="49" width="30" height="14" rx="5" fill="#9b8cff" />
  <circle cx="22" cy="10" r="7" fill="#2f9e6a" /><circle cx="130" cy="12" r="7" fill="#2f9e6a" />
  <ellipse cx="80" cy="80" rx="9" ry="3" fill="#000" opacity=".35" filter={`url(#${u}-soft)`} />
  <circle cx="80" cy="75" r="8" fill={f('green')} /><circle cx="76" cy="72" r="2" fill="#fff" /><circle cx="84" cy="72" r="2" fill="#fff" />
</g>

/** Mole Mash: a lawn of nine holes with a mole, a golden star and a bomb popping up. */
const moleMash: Cover = (u, f) => <g>
  <rect width="160" height="90" fill="#1c4a2a" />
  {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => <ellipse key={`${r}${c}`} cx={32 + c * 48} cy={20 + r * 26} rx="15" ry="7" fill="#0b1410" />))}
  <path d="M65 40a15 13 0 0 1 30 0z" fill={f('orange')} /><circle cx="73" cy="32" r="2" fill="#0b1410" /><circle cx="87" cy="32" r="2" fill="#0b1410" /><ellipse cx="80" cy="37" rx="4" ry="2.6" fill="#f4b3a0" />
  <path d="M104 66l3 7 7 .4-5.5 4.6 2 7-6.5-4-6.5 4 2-7-5.5-4.6 7-.4z" fill={f('yellow')} transform="translate(-20 -16)" />
  <circle cx="128" cy="62" r="8" fill="#222a35" /><path d="M132 55l4-5" stroke="#ffb454" strokeWidth="2" />
  <ellipse cx="80" cy="80" rx="12" ry="3" fill="#000" opacity=".25" filter={`url(#${u}-soft)`} />
</g>

/** Space Defender: a wave of invaders, one hit, and the cannon firing from behind the shields. */
/** Rock Blaster: a small ship among drifting rocks, a bullet on its way. */
const asteroidAssault: Cover = (u, f) => <g>
  <rect width="160" height="90" fill="#080b14" />
  <circle cx="30" cy="24" r="13" fill="#2a3550" stroke="#9fb4d8" strokeWidth="1" />
  <circle cx="124" cy="62" r="16" fill="#33405f" stroke="#9fb4d8" strokeWidth="1" />
  <circle cx="132" cy="20" r="6" fill="#3c4b70" stroke="#9fb4d8" strokeWidth="1" />
  <circle cx="22" cy="70" r="5" fill="#3c4b70" stroke="#9fb4d8" strokeWidth="1" />
  <g transform="translate(76 52) rotate(30)"><path d="M0 -9 L6 6 L0 2.4 L-6 6 Z" fill="#ecf3fd" stroke={f('gold')} strokeWidth="1" /></g>
  <circle cx="92" cy="36" r="1.6" fill={f('gold')} />
  <circle cx="99" cy="30" r="1.6" fill={f('gold')} />
</g>

/** Marble Maze: a maze with a marble, a hole and the green goal. */
const marbleMaze: Cover = (u, f) => <g>
  <rect width="160" height="90" fill="#0e1420" />
  <rect x="20" y="10" width="120" height="70" fill="#1a2236" />
  <path d="M20 10h120v70H20zM20 38h56M76 38v-28M76 38v28M104 80V30M104 30h36M48 66h28" fill="none" stroke="#9fb4d8" strokeWidth="2.5" strokeLinecap="square" />
  <circle cx="52" cy="24" r="6" fill="#04060b" stroke="#384860" />
  <circle cx="122" cy="62" r="7" fill="#34c27a" stroke="#b6f5d3" />
  <circle cx="36" cy="52" r="6" fill="#e6edf7" stroke={f('gold')} />
  <ellipse cx="36" cy="58" rx="5" ry="1.6" fill="#000" opacity=".3" filter={`url(#${u}-soft)`} />
</g>

/** Pinball: a table with three pop bumpers, two flippers and a ball mid-flight. */
const pinball: Cover = (u, f) => <g>
  <rect width="160" height="90" fill="#150f2a" />
  <path d="M20 6 H140 V84 H20 Z" fill="#1d1540" stroke="#7fd8ff" strokeWidth="1.4" />
  {[[60, 28], [100, 28], [80, 46]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="9" fill="#2a1740" stroke="#ff6b8b" strokeWidth="2" /><circle cx={x} cy={y} r="3.5" fill={f('red')} /></g>)}
  {[52, 80, 108].map((x) => <circle key={x} cx={x} cy="14" r="3" fill={f('gold')} />)}
  <path d="M60 78 L74 72 M100 78 L86 72" stroke="#ffc247" strokeWidth="4" strokeLinecap="round" />
  <circle cx="120" cy="58" r="3.4" fill="#f1f6ff" />
  <ellipse cx="80" cy="86" rx="40" ry="3" fill="#000" opacity=".3" filter={`url(#${u}-soft)`} />
</g>

<<<<<<< HEAD
<<<<<<< HEAD
/** Rhythm Master: four lanes, falling notes and the glowing hit line. */
const rhythmMaster: Cover = (u, f) => <g>
  <rect width="160" height="90" fill="#080b14" />
  {[0, 1, 2, 3].map((i) => <rect key={i} x={36 + i * 22} y="0" width="20" height="90" fill="#131c33" />)}
  {[[0, 22], [1, 40], [2, 12], [3, 56], [1, 66], [2, 30]].map(([l, y], i) => <rect key={i} x={40 + l * 22} y={y} width="12" height="7" rx="3" fill={['#7fd8ff', '#ff8fb0', '#9dff9d', '#ffd66b'][l]} />)}
  <rect x="34" y="72" width="92" height="3" fill={f('gold')} />
  <ellipse cx="80" cy="86" rx="40" ry="3" fill="#000" opacity=".3" filter={`url(#${u}-soft)`} />
=======
/** Pixel Run: a small hero on a grassy ledge, a coin, a spike and the flag. */
const pixelRun: Cover = (u, f) => <g>
  <rect width="160" height="90" fill="#6ec8ff" />
  <rect y="56" width="160" height="34" fill="#7a5236" />
  <rect y="56" width="160" height="6" fill="#4fbf5d" />
  <rect x="62" y="62" width="22" height="28" fill="#6ec8ff" />
  <polygon points="96,56 102,44 108,56 114,44 120,56" fill="#c9d3e0" stroke="#6b7a90" strokeWidth="1" />
  <ellipse cx="80" cy="36" rx="5" ry="6" fill={f('gold')} stroke="#c98e00" strokeWidth="1" />
  <rect x="34" y="40" width="12" height="16" fill="#3f7cff" /><rect x="34" y="34" width="12" height="8" fill="#ffd2a6" /><rect x="33" y="31" width="13" height="4" fill="#e8465f" />
  <rect x="138" y="26" width="2.5" height="30" fill="#f1f6ff" /><polygon points="140.5,26 154,31 140.5,36" fill={f('red')} />
>>>>>>> origin/feature/pixel-run
=======
const towerDefense: Cover = (u, f) => <g>
  <rect width="160" height="90" fill="#10261d" />
  <path d="M-4 20 H120 V46 H40 V70 H130 V94" fill="none" stroke="#6b5a3a" strokeWidth="12" strokeLinejoin="round" />
  {[[30, 34], [80, 34], [80, 58], [140, 60]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8" fill={['#ffc247', '#7fd8ff', '#ff6b8b', '#ffc247'][i]} stroke="#fff" strokeWidth="1.4" />)}
  {[[60, 20], [100, 20], [40, 46]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.5" fill={f('red')} stroke="#0b0f1a" strokeWidth="1" />)}
  <path d="M80 34 L100 20" stroke="#fff" strokeWidth="1.2" opacity=".8" />
  <ellipse cx="80" cy="87" rx="40" ry="3" fill="#000" opacity=".3" filter={`url(#${u}-soft)`} />
>>>>>>> origin/feature/tower-defense
</g>

export const ARCADE_COVERS: Record<string, Cover> = {
  'stack-tower': stackTower,
  'lane-hopper': laneHopper,
  'mole-mash': moleMash,
  'traffic-dodger': trafficDodger,
<<<<<<< HEAD
<<<<<<< HEAD
  'pulse-tap': pulseTap, 'neon-snake': neonSnake, 'brick-breaker': brickBreaker, 'neon-pong': neonPong, 'space-defender': spaceDefender, 'gravity-flip': gravityFlip, 'asteroid-assault': asteroidAssault, pinball, 'rhythm-master': rhythmMaster, 'marble-maze': marbleMaze }
=======
  'pulse-tap': pulseTap, 'neon-snake': neonSnake, 'brick-breaker': brickBreaker, 'neon-pong': neonPong, 'space-defender': spaceDefender, 'gravity-flip': gravityFlip, 'asteroid-assault': asteroidAssault, pinball, 'pixel-run': pixelRun }
>>>>>>> origin/feature/pixel-run
=======
  'pulse-tap': pulseTap, 'neon-snake': neonSnake, 'brick-breaker': brickBreaker, 'neon-pong': neonPong, 'space-defender': spaceDefender, 'gravity-flip': gravityFlip, 'asteroid-assault': asteroidAssault, pinball, 'tower-defense': towerDefense }
>>>>>>> origin/feature/tower-defense
