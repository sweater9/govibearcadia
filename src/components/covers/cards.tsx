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

export const CARD_COVERS: Record<string, Cover> = { 'indian-rummy': rummy, blackjack, poker }
