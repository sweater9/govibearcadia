/* eslint-disable react-refresh/only-export-components -- a table of SVG drawings, not a hot-reloaded component module */
import type { ReactNode } from 'react'
import { Card, Shadow, font, type Paint, type Suit } from './parts'

type Cover = (u: string, f: Paint) => ReactNode

/** A stack of casino chips: n chips, each with edge stripes. */
function Chips({ u, f, cx, base, n, m }: { u: string; f: Paint; cx: number; base: number; n: number; m: string }) {
  const rx = 9
  const ry = 3.4
  const h = 2.6
  return <g>
    <Shadow u={u} cx={cx + 1} cy={base + 1} rx={rx + 1} ry={ry + 0.5} o={0.5} />
    {Array.from({ length: n }, (_, i) => {
      const y = base - i * h
      return <g key={i}>
        <path d={`M${cx - rx} ${y - h} V${y} A${rx} ${ry} 0 0 0 ${cx + rx} ${y} V${y - h}Z`} fill={f(m)} />
        {[-6.5, -3, 0.5, 4, 7.5].map((d) => <rect key={d} x={cx + d - 0.9} y={y - h + 0.3} width="1.8" height={h - 0.6} fill="#fff" opacity=".75" />)}
        <path d={`M${cx - rx} ${y} A${rx} ${ry} 0 0 0 ${cx + rx} ${y}`} fill="none" stroke="#000" strokeOpacity=".3" strokeWidth=".4" />
      </g>
    })}
    {(() => {
      const y = base - n * h
      return <g>
        <ellipse cx={cx} cy={y} rx={rx} ry={ry} fill={f(m)} />
        <ellipse cx={cx} cy={y} rx={rx - 1.4} ry={ry - 0.6} fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth=".8" strokeDasharray="2.2 1.6" />
        <ellipse cx={cx} cy={y} rx={rx * 0.45} ry={ry * 0.45} fill="#fff" opacity=".25" />
      </g>
    })()}
  </g>
}

const star = (cx: number, cy: number, r: number) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.42 : r
    return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`
  })
  return pts.join(' ')
}

/** Indian Rummy: a fan of thirteen-card-style hand with a pure sequence, a set and a joker. */
const rummy: Cover = (u, f) => {
  const hand: [string, Suit | null][] = [['5', 'H'], ['6', 'H'], ['7', 'H'], ['9', 'S'], ['9', 'D'], ['9', 'C'], ['★', null]]
  return <g>
    <rect width="160" height="90" fill={f('felt')} />
    <ellipse cx="80" cy="96" rx="64" ry="12" fill="#000" opacity=".25" filter={`url(#${u}-soft)`} />
    {hand.map(([rank, suit], i) => {
      const a = -30 + i * 10
      return <g key={i} transform={`rotate(${a} 80 112)`}>
        <Card u={u} x={66} y={30} w={28} h={40} rank={rank} suit={suit ?? undefined} />
        {!suit ? <polygon points={star(80, 54, 9)} fill="#8b5bf0" stroke="#fff" strokeWidth=".6" /> : null}
      </g>
    })}
  </g>
}

/** Blackjack: an ace and a king making 21, a stack of chips beside them. */
const blackjack: Cover = (u, f) => <g>
  <rect width="160" height="90" fill={f('felt')} />
  <path d="M14 22 Q80 -2 146 22" fill="none" stroke="#e8c36a" strokeOpacity=".75" strokeWidth="1.2" />
  <path d="M24 32 Q80 12 136 32" fill="none" stroke="#e8c36a" strokeOpacity=".35" strokeWidth=".8" strokeDasharray="3 3" />
  <Card u={u} x={34} y={32} w={34} h={48} rot={-9} rank="A" suit="S" />
  <Card u={u} x={52} y={28} w={34} h={48} rot={7} rank="K" suit="H" />
  <g>
    <circle cx="106" cy="30" r="8.4" fill="#000" opacity=".35" filter={`url(#${u}-soft)`} />
    <circle cx="105" cy="28" r="8.4" fill={f('gold')} stroke="#7a4d00" strokeWidth=".6" />
    <text x="105" y="31.3" textAnchor="middle" fontSize="9" {...font} fill="#4a2c00">21</text>
  </g>
  <Chips u={u} f={f} cx={120} base={78} n={5} m="red" />
  <Chips u={u} f={f} cx={104} base={84} n={3} m="blue" />
  <Chips u={u} f={f} cx={138} base={84} n={4} m="ink" />
</g>

/** Poker: a heart flush on the board, a pair of hole cards, chips and the dealer button. */
const poker: Cover = (u, f) => <g>
  <rect width="160" height="90" fill={f('feltN')} />
  <ellipse cx="80" cy="45" rx="76" ry="38" fill="none" stroke="#fff" strokeOpacity=".1" strokeWidth="1" />
  {[['10', 'H'], ['J', 'H'], ['Q', 'H']].map(([r, s], i) => <Card key={r} u={u} x={22 + i * 24} y={9} w={21} h={30} rank={r} suit={s as Suit} />)}
  <Card u={u} x={94} y={9} w={21} h={30} back back2="#2457d6" />
  <Card u={u} x={118} y={9} w={21} h={30} back back2="#2457d6" />
  <Card u={u} x={34} y={50} w={28} h={38} rot={-10} rank="A" suit="H" />
  <Card u={u} x={52} y={50} w={28} h={38} rot={8} rank="K" suit="H" />
  <Chips u={u} f={f} cx={112} base={80} n={5} m="red" />
  <Chips u={u} f={f} cx={130} base={84} n={3} m="green" />
  <g>
    <circle cx="96" cy="68" r="6.4" fill="#000" opacity=".4" filter={`url(#${u}-soft)`} />
    <circle cx="95" cy="66.5" r="6" fill={f('ivory')} stroke="#000" strokeOpacity=".3" strokeWidth=".5" />
    <text x="95" y="69" textAnchor="middle" fontSize="7" {...font} fill="#1b2230">D</text>
  </g>
</g>

/** Klondike: a tableau of fanned columns and an ace heading for its pile. */
const klondike: Cover = (u, f) => <g>
  <rect width="160" height="90" fill={f('felt')} />
  <ellipse cx="80" cy="45" rx="76" ry="38" fill="none" stroke="#fff" strokeOpacity=".08" strokeWidth="1" />
  <Card u={u} x={12} y={10} w={22} h={31} back back2="#2457d6" />
  <Card u={u} x={104} y={10} w={22} h={31} rank="A" suit="S" />
  <Card u={u} x={130} y={10} w={22} h={31} rank="A" suit="H" />
  {[0, 1, 2, 3].map((i) => <Card key={'a' + i} u={u} x={14 + i * 26} y={44 + i * 3} w={22} h={31} back back2="#2457d6" />)}
  <Card u={u} x={14} y={50} w={22} h={31} rank="K" suit="D" />
  <Card u={u} x={40} y={53} w={22} h={31} rank="Q" suit="S" rot={-3} />
  <Card u={u} x={66} y={56} w={22} h={31} rank="J" suit="H" />
  <Card u={u} x={92} y={59} w={22} h={31} rank="10" suit="C" />
</g>

/** Call Break: a hand of spades beating a trick, the trump suit front and centre. */
const callBreak: Cover = (u, f) => <g>
  <rect width="160" height="90" fill={f('feltN')} />
  <ellipse cx="80" cy="45" rx="76" ry="38" fill="none" stroke="#fff" strokeOpacity=".1" strokeWidth="1" />
  <Card u={u} x={56} y={8} w={22} h={31} rank="K" suit="H" rot={-6} />
  <Card u={u} x={82} y={8} w={22} h={31} rank="9" suit="D" rot={6} />
  <Card u={u} x={69} y={14} w={24} h={34} rank="2" suit="S" />
  {[['A', 'S'], ['K', 'S'], ['Q', 'S'], ['J', 'S'], ['8', 'S']].map(([r, s], i) => <Card key={r} u={u} x={22 + i * 24} y={52} w={24} h={34} rank={r} suit={s as Suit} rot={(i - 2) * 4} />)}
</g>

/** Cribbage: a fifteen on the felt and a peg board with two pegs racing to the hole at the end. */
const cribbage: Cover = (u, f) => <g>
  <rect width="160" height="90" fill={f('felt')} />
  <rect x="16" y="8" width="128" height="22" rx="5" fill={f('woodD')} stroke="#3d2412" strokeWidth=".8" />
  {[0, 1].map((row) => Array.from({ length: 21 }, (_, i) => <circle key={`${row}-${i}`} cx={24 + i * 5.8} cy={14 + row * 10} r="1.3" fill="#1a0f07" />))}
  <circle cx={24 + 13 * 5.8} cy="14" r="2.3" fill={f('red')} />
  <circle cx={24 + 9 * 5.8} cy="24" r="2.3" fill={f('blue')} />
  <circle cx="141" cy="19" r="2.6" fill="#1a0f07" stroke={f('gold')} strokeWidth=".8" />
  <Card u={u} x={36} y={40} w={32} h={46} rot={-10} rank="5" suit="H" />
  <Card u={u} x={56} y={38} w={32} h={46} rot={-2} rank="5" suit="S" />
  <Card u={u} x={76} y={38} w={32} h={46} rot={6} rank="5" suit="D" />
  <Card u={u} x={96} y={40} w={32} h={46} rot={13} rank="J" suit="C" />
</g>

/** Durak: a defence in progress, the trump card tucked under the deck. */
const durak: Cover = (u) => <g>
  <rect width="160" height="90" fill="#16324d" />
  <Card u={u} x={18} y={46} w={26} h={38} back rot={-4} />
  <Card u={u} x={24} y={44} w={26} h={38} back rot={-1} />
  <Card u={u} x={32} y={28} w={26} h={38} rot={90} rank="A" suit="H" />
  <Card u={u} x={58} y={14} w={34} h={48} rot={-4} rank="9" suit="S" />
  <Card u={u} x={66} y={20} w={34} h={48} rot={5} rank="J" suit="S" />
  <Card u={u} x={102} y={14} w={34} h={48} rot={-4} rank="7" suit="C" />
  <Card u={u} x={110} y={20} w={34} h={48} rot={5} rank="7" suit="H" />
</g>

/** Scopa: a settebello and a cup on the felt, a scopa about to be made. */
const scopa: Cover = (u, f) => <g>
  <rect width="160" height="90" fill={f('felt')} />
  {[[26, 30, -8], [50, 26, -3], [74, 26, 3], [98, 30, 8]].map(([x, y, r], i) => <g key={i}>
    <g transform={`rotate(${r} ${x + 14} ${y + 20})`}>
      <rect x={x + 1} y={y + 2} width="28" height="40" rx="3" fill="#000" opacity=".3" />
      <rect x={x} y={y} width="28" height="40" rx="3" fill="#fbf8ef" stroke="#000" strokeOpacity=".25" strokeWidth=".5" />
      {i === 0 ? <><circle cx={x + 14} cy={y + 21} r="8" fill="#d9a21b44" stroke="#d9a21b" strokeWidth="1.6" /><circle cx={x + 14} cy={y + 21} r="3.2" fill="none" stroke="#d9a21b" strokeWidth="1.4" /><text x={x + 3} y={y + 9} fontSize="8" {...font} fill="#1b2230">7</text></> : null}
      {i === 1 ? <><path d={`M${x + 7} ${y + 12}h14c0 8-3 11-7 11s-7-3-7-11zM${x + 14} ${y + 23}v7M${x + 10} ${y + 32}h8`} fill="#c6283233" stroke="#c62832" strokeWidth="1.5" strokeLinecap="round" /><text x={x + 3} y={y + 9} fontSize="8" {...font} fill="#1b2230">3</text></> : null}
      {i === 2 ? <><path d={`M${x + 14} ${y + 10}l3 3v13h-6V13zM${x + 8} ${y + 26}h12M${x + 14} ${y + 26}v9`} fill="#2b5fc433" stroke="#2b5fc4" strokeWidth="1.5" strokeLinecap="round" /><text x={x + 3} y={y + 9} fontSize="8" {...font} fill="#1b2230">4</text></> : null}
      {i === 3 ? <><path d={`M${x + 11} ${y + 10}h6l1 6-2 3v12h-4V19l-2-3z`} fill="#2f8f4a33" stroke="#2f8f4a" strokeWidth="1.5" strokeLinejoin="round" /><text x={x + 3} y={y + 9} fontSize="8" {...font} fill="#1b2230">R</text></> : null}
    </g>
  </g>)}
  <circle cx="132" cy="58" r="9" fill={f('gold')} stroke="#7a4d00" strokeWidth=".6" />
  <text x="132" y="61.5" textAnchor="middle" fontSize="10" {...font} fill="#4a2c00">11</text>
</g>

const slapPile: Cover = (u, f) => <g>
  <rect x="52" y="14" width="40" height="58" rx="5" fill={f('paper')} stroke="#1b2230" strokeWidth="1.2" transform="rotate(-8 72 43)" />
  <rect x="66" y="14" width="40" height="58" rx="5" fill={f('paper')} stroke="#1b2230" strokeWidth="1.2" transform="rotate(6 86 43)" />
  <text x="86" y="52" textAnchor="middle" fontSize="26" fontWeight="800" fill="#1b2230">K</text>
  <path d="M112 62c-4-10-4-20 0-26l6 2-2 8 8-2 2 6-6 4 4 8z" fill={f('gold')} stroke="#7a4d00" strokeWidth=".8" />
</g>

export const CARD_COVERS: Record<string, Cover> = { 'indian-rummy': rummy, blackjack, poker, klondike, 'call-break': callBreak, cribbage, durak, scopa, 'slap-pile': slapPile }
