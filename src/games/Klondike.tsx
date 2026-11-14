import { useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps, GameResult } from '../types'
import { apply, autoFinish, canAutoFinish, canMove, hasMoves, isRed, isWon, newGame, rankOf, suitOf, type Action, type DrawMode, type Source, type State, type Target } from './klondike/rules'
import './klondike/klondike.css'

const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const RANK_NAMES = ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King']
const SUIT_PATH = [
  'M12 2c3 4 8 6.5 8 11a4.2 4.2 0 0 1-7 3.1c.2 2 .9 3.6 2.5 5.4h-7c1.6-1.8 2.3-3.4 2.5-5.4A4.2 4.2 0 0 1 4 13c0-4.5 5-7 8-11z',
  'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z',
  'M12 2l7 10-7 10-7-10z',
  'M12 2.5a4.3 4.3 0 0 0-3.2 7.2A4.5 4.5 0 1 0 11 16.6c-.1 1.9-.8 3.4-2.4 5h6.8c-1.6-1.6-2.3-3.1-2.4-5a4.5 4.5 0 1 0 2.2-6.9A4.3 4.3 0 0 0 12 2.5z',
]
/** Distance between stacked cards, in card widths. Face-down cards sit tighter than face-up ones. */
const DOWN = 0.2
const UP = 0.5
const COLUMN = 8.2

const cardName = (c: number) => `${RANK_NAMES[rankOf(c)]} of ${SUIT_NAMES[suitOf(c)]}`
const same = (a: Source | null, b: Source) => !!a && JSON.stringify(a) === JSON.stringify(b)

function Suit({ suit, className }: { suit: number; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d={SUIT_PATH[suit]} fill="currentColor" /></svg>
}

function Face({ card, style, selected, drop, onClick, label }: { card: number; style?: React.CSSProperties; selected?: boolean; drop?: boolean; onClick: () => void; label?: string }) {
  return (
    <button type="button" className="kl-card" style={style} data-red={isRed(card) ? 'true' : undefined} data-selected={selected ? 'true' : undefined} data-drop={drop ? 'true' : undefined} aria-label={label ?? cardName(card)} aria-pressed={selected ? true : undefined} onClick={onClick}>
      <span className="kl-corner"><b>{RANKS[rankOf(card)]}</b><Suit suit={suitOf(card)} /></span>
      <Suit suit={suitOf(card)} className="kl-big" />
    </button>
  )
}

export function Klondike({ onFinish, seed }: GameProps) {
  const [base] = useState(() => seed ?? String(createRandom()()))
  const seedFor = (n: number) => (n === 0 ? base : `${base}-${n}`)
  const [deal, setDeal] = useState(0)
  const [draw, setDraw] = useState<DrawMode>(1)
  const [game, setGame] = useState<State>(() => newGame(seedFor(0), 1))
  const [history, setHistory] = useState<State[]>([])
  const [sel, setSel] = useState<Source | null>(null)
  const [result, setResult] = useState<GameResult | null>(null)
  const [startedAt, setStartedAt] = useState(() => Date.now())
  const [reported, setReported] = useState(false)

  const won = isWon(game)
  const stuck = !won && !hasMoves(game)

  function start(nextDeal: number, mode: DrawMode) {
    setDeal(nextDeal)
    setDraw(mode)
    setGame(newGame(seedFor(nextDeal), mode))
    setHistory([])
    setSel(null)
    setResult(null)
    setStartedAt(Date.now())
    setReported(false)
  }

  /** Replace the game state; the first time it is won, report the run once from here (an event handler, never an updater). */
  function commit(next: State) {
    setHistory((h) => [...h, game])
    setGame(next)
    setSel(null)
    if (isWon(next) && !reported) {
      setReported(true)
      const durationMs = Math.max(0, Date.now() - startedAt)
      const seconds = Math.max(1, durationMs / 1000)
      const bonus = seconds > 30 ? Math.floor(700000 / seconds) : 0
      const finished: GameResult = { score: next.points + bonus, durationMs, won: true, stats: { moves: next.moves, points: next.points, draw: next.draw, recycles: next.recycles } }
      setResult(finished)
      onFinish(finished)
    }
  }
  const act = (a: Action) => {
    const next = apply(game, a)
    if (next === game) return false
    commit(next)
    return true
  }
  const move = (src: Source, to: Target) => act({ type: 'move', ...src, ...to })

  function tapCard(src: Source, top: boolean, dest?: number) {
    if (won) return
    if (sel && same(sel, src)) {
      // Tapping the chosen card again sends it home, if it can go.
      if (canMove(game, src, { to: 'foundation' })) move(src, { to: 'foundation' })
      else setSel(null)
      return
    }
    if (sel && top && dest !== undefined && move(sel, { to: 'tableau', dest })) return
    setSel(src)
  }
  const tapFoundation = (suit: number) => {
    if (won) return
    if (sel) {
      if (move(sel, { to: 'foundation' })) return
      setSel(null)
      return
    }
    if (game.foundations[suit].length) setSel({ from: 'foundation', suit })
  }
  const tapEmpty = (dest: number) => {
    if (sel && !move(sel, { to: 'tableau', dest })) setSel(null)
  }
  const undo = () => {
    const prev = history[history.length - 1]
    if (!prev || won) return
    setGame(prev)
    setHistory((h) => h.slice(0, -1))
    setSel(null)
  }

  const canDrop = (to: Target) => !!sel && canMove(game, sel, to)
  const wasteShown = game.waste.slice(-(game.draw === 3 ? 3 : 1))

  return (
    <div className="kl">
      <div className="kl-bar">
        <span className="kl-stat" aria-live="polite">Score <b>{game.points}</b></span>
        <span className="kl-stat">Moves <b>{game.moves}</b></span>
        <div className="kl-seg" role="group" aria-label="Cards drawn at a time">
          {([1, 3] as const).map((m) => <button key={m} type="button" aria-pressed={draw === m} onClick={() => draw !== m && start(deal + 1, m)}>Draw {m}</button>)}
        </div>
        <button type="button" className="secondary-btn kl-btn" onClick={undo} disabled={!history.length || won}>Undo</button>
        {canAutoFinish(game) && <button type="button" className="primary-btn kl-btn" onClick={() => commit(autoFinish(game))}>Finish</button>}
        <button type="button" className="secondary-btn kl-btn" onClick={() => start(deal + 1, draw)}>New deal</button>
      </div>

      <div className="kl-board">
        <div className="kl-top">
          <div className="kl-cell">
            {game.stock.length || game.waste.length ? (
              <button type="button" className="kl-card kl-back kl-stock" aria-label={game.stock.length ? `Draw from the deck, ${game.stock.length} cards left` : 'Turn the waste over to draw again'} onClick={() => { setSel(null); act({ type: 'draw' }) }}>
                {!game.stock.length && <span className="kl-redeal">↻</span>}
              </button>
            ) : <span className="kl-slot" aria-hidden="true" />}
          </div>
          <div className="kl-cell kl-waste">
            {wasteShown.map((c, i) => {
              const isTop = i === wasteShown.length - 1
              const style = { left: `calc(var(--w) * ${i * 0.32})` }
              return isTop
                ? <Face key={c} card={c} style={style} selected={same(sel, { from: 'waste' })} onClick={() => tapCard({ from: 'waste' }, false)} />
                : <span key={c} className="kl-card kl-peek" style={style} aria-hidden="true"><span className="kl-corner"><b>{RANKS[rankOf(c)]}</b><Suit suit={suitOf(c)} /></span></span>
            })}
          </div>
          <span className="kl-gap" />
          {game.foundations.map((f, suit) => {
            const top = f[f.length - 1]
            return (
              <div className="kl-cell" key={suit}>
                <button type="button" className="kl-slot kl-found" data-suit={suit} data-drop={canDrop({ to: 'foundation' }) && sel && suitOf(picked0(game, sel)) === suit ? 'true' : undefined} aria-label={`${SUIT_NAMES[suit][0].toUpperCase()}${SUIT_NAMES[suit].slice(1)} foundation, ${f.length} of 13`} onClick={() => tapFoundation(suit)}>
                  <Suit suit={suit} />
                </button>
                {top !== undefined && <Face card={top} selected={same(sel, { from: 'foundation', suit })} label={`${cardName(top)} on the ${SUIT_NAMES[suit]} foundation`} onClick={() => tapFoundation(suit)} />}
              </div>
            )
          })}
        </div>

        <div className="kl-tableau">
          {game.tableau.map((pile, p) => {
            const down = pile.down.length * DOWN
            const step = pile.up.length > 1 ? Math.max(0.28, Math.min(UP, (COLUMN - 1.4 - down) / (pile.up.length - 1))) : UP
            return (
              <div className="kl-col" key={p}>
                {pile.down.map((_, i) => <span key={i} className="kl-card kl-back" style={{ top: `calc(var(--w) * ${i * DOWN})` }} aria-hidden="true" />)}
                {pile.up.map((c, i) => {
                  const src: Source = { from: 'tableau', pile: p, index: i }
                  const top = i === pile.up.length - 1
                  const chosen = !!sel && sel.from === 'tableau' && sel.pile === p && i >= sel.index
                  return <Face key={c} card={c} style={{ top: `calc(var(--w) * ${down + i * step})` }} selected={chosen} drop={top && canDrop({ to: 'tableau', dest: p })} onClick={() => tapCard(src, top, p)} />
                })}
                {!pile.up.length && <button type="button" className="kl-slot kl-empty" data-drop={canDrop({ to: 'tableau', dest: p }) ? 'true' : undefined} aria-label={`Empty column ${p + 1}`} onClick={() => tapEmpty(p)} />}
              </div>
            )
          })}
        </div>

        {(won || stuck) && (
          <div className="kl-over" role="status">
            <strong>{won ? 'You won!' : 'No moves left'}</strong>
            {won && result && <span>Score {result.score} · {game.moves} moves</span>}
            {stuck && <span>Undo a move or start a new deal.</span>}
            <button type="button" className="primary-btn" onClick={() => start(deal + 1, draw)}>New deal</button>
          </div>
        )}
      </div>
      <p className="kl-help">Tap a card, then where it goes. Tap it again to send it to its pile.</p>
    </div>
  )
}

/** The card a selection would pick up (bottom of a run), for highlighting the matching foundation. */
function picked0(s: State, src: Source): number {
  if (src.from === 'waste') return s.waste[s.waste.length - 1]
  if (src.from === 'foundation') return s.foundations[src.suit][s.foundations[src.suit].length - 1]
  return s.tableau[src.pile].up[src.index]
}
