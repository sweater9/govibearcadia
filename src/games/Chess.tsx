import { useEffect, useRef, useState } from 'react'
import { createRandom } from '../lib/rng'
import type { GameProps, GameResult } from '../types'
import { LEVELS, chooseMove, type Level } from './chess/ai'
import { apply, describe, inCheck, legalMoves, newGame, squareName, status, type Color, type Move, type Promo, type State, type Status } from './chess/rules'
import './chess/chess.css'

const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
const NAME: Record<string, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }
const PROMOS: { p: Promo; label: string }[] = [{ p: 'q', label: 'Queen' }, { p: 'r', label: 'Rook' }, { p: 'b', label: 'Bishop' }, { p: 'n', label: 'Knight' }]
const LEVEL_BONUS: Record<Level, number> = { easy: 0, normal: 300, hard: 700 }
const colorOf = (p: string): Color => (p === p.toUpperCase() ? 'w' : 'b')

type Ply = { before: State; move: Move; san: string }
const ENDINGS: Record<Exclude<Status, 'playing' | 'checkmate'>, string> = { stalemate: 'Stalemate: a draw', 'fifty-moves': 'Draw by the fifty-move rule', repetition: 'Draw by repetition', material: 'Draw: not enough pieces to checkmate' }

export function Chess({ onFinish, seed }: GameProps) {
  const [base] = useState(() => seed ?? String(createRandom()()))
  const [games, setGames] = useState(0)
  const [level, setLevel] = useState<Level>('normal')
  const [side, setSide] = useState<Color>('w')
  const [started, setStarted] = useState(false)
  const [state, setState] = useState<State>(() => newGame())
  const [plies, setPlies] = useState<Ply[]>([])
  const [picked, setPicked] = useState<number | null>(null)
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null)
  const [thinking, setThinking] = useState(false)
  const [resigned, setResigned] = useState(false)
  const [result, setResult] = useState<GameResult | null>(null)
  const [startedAt, setStartedAt] = useState(0)
  const [reported, setReported] = useState(false)
  const random = useRef(createRandom(base))

  const st = status(state)
  const over = st !== 'playing' || resigned
  const myTurn = started && !over && state.turn === side
  const legal = picked !== null && myTurn ? legalMoves(state).filter((m) => m.from === picked) : []
  const last = plies[plies.length - 1]?.move

  function finishIfOver(next: State, gaveUp: boolean) {
    const s = status(next)
    if (reported || (s === 'playing' && !gaveUp)) return
    setReported(true)
    const iWon = s === 'checkmate' && next.turn !== side
    const finished: GameResult = {
      score: iWon ? 300 + LEVEL_BONUS[level] + Math.max(0, 300 - next.full * 3) : s === 'playing' || s === 'checkmate' ? 0 : 150,
      durationMs: Math.max(0, Date.now() - startedAt),
      won: iWon,
      stats: { moves: next.full, level: LEVELS.indexOf(level) },
    }
    setResult(finished)
    onFinish(finished)
  }

  function play(m: Move) {
    const next = apply(state, m)
    if (!next) return
    setPlies((p) => [...p, { before: state, move: m, san: describe(state, m) }])
    setState(next)
    setPicked(null)
    setPromo(null)
    finishIfOver(next, false)
  }

  // The computer replies after a short pause so you can see your own move land first.
  useEffect(() => {
    if (!started || over || state.turn === side) return
    setThinking(true)
    const id = setTimeout(() => {
      const m = chooseMove(state, level, random.current)
      setThinking(false)
      if (m) play(m)
    }, 350)
    return () => { clearTimeout(id); setThinking(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- play closes over the same state this effect depends on
  }, [state, started, side, level, over])

  function begin(chosen: Color) {
    const fresh = newGame()
    random.current = createRandom(`${base}-${games}`)
    setGames((g) => g + 1)
    setSide(chosen)
    setState(fresh)
    setPlies([])
    setPicked(null)
    setPromo(null)
    setResigned(false)
    setResult(null)
    setReported(false)
    setStartedAt(Date.now())
    setStarted(true)
  }

  function tap(sq: number) {
    if (!myTurn || promo) return
    const piece = state.board[sq]
    if (picked !== null) {
      const hits = legal.filter((m) => m.to === sq)
      if (hits.length > 1) { setPromo({ from: picked, to: sq }); return }
      if (hits.length === 1) { play(hits[0]); return }
    }
    setPicked(piece && colorOf(piece) === side && piece && sq !== picked ? sq : null)
  }

  function undo() {
    // Take back your last move and the computer's reply to it.
    const i = plies.map((p) => p.before.turn).lastIndexOf(side)
    if (i < 0) return
    setState(plies[i].before)
    setPlies(plies.slice(0, i))
    setPicked(null)
    setPromo(null)
  }

  function resign() {
    if (over || reported) return
    setResigned(true)
    finishIfOver(state, true)
  }

  const order = Array.from({ length: 64 }, (_, i) => (side === 'w' ? i : 63 - i))
  const checkedKing = st !== 'stalemate' && inCheck(state) ? state.board.indexOf(state.turn === 'w' ? 'K' : 'k') : -1
  const moveText = plies.slice(-8).map((p, i) => ({ n: plies.length - Math.min(8, plies.length) + i, san: p.san }))
  const banner = !started ? '' : resigned ? 'You resigned.' : st === 'checkmate' ? (state.turn === side ? 'Checkmate. The computer wins.' : 'Checkmate! You win.') : st !== 'playing' ? ENDINGS[st] : thinking ? 'The computer is thinking…' : myTurn ? (inCheck(state) ? 'Check! Your move.' : 'Your move.') : ''

  if (!started) {
    return (
      <div className="ch ch-setup">
        <h2>Play against the computer</h2>
        <div className="ch-seg" role="group" aria-label="Computer level">
          {LEVELS.map((l) => <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>{l[0].toUpperCase() + l.slice(1)}</button>)}
        </div>
        <p className="ch-note">{level === 'easy' ? 'Looks one move ahead and makes mistakes.' : level === 'normal' ? 'Looks two moves ahead and captures carefully.' : 'Looks three moves ahead. Takes a second or two to move.'}</p>
        <div className="ch-seg">
          <button type="button" className="primary-btn" onClick={() => begin('w')}>Play White</button>
          <button type="button" className="secondary-btn" onClick={() => begin('b')}>Play Black</button>
        </div>
      </div>
    )
  }

  return (
    <div className="ch">
      <div className="ch-bar">
        <span className="ch-banner" role="status" aria-live="polite">{banner}</span>
      </div>
      <div className="ch-board" role="grid" aria-label="Chess board">
        {order.map((sq) => {
          const p = state.board[sq]
          const dark = (Math.floor(sq / 8) + (sq % 8)) % 2 === 1
          const target = legal.some((m) => m.to === sq)
          const file = sq % 8
          const rank = Math.floor(sq / 8)
          return (
            <button
              key={sq}
              type="button"
              className="ch-sq"
              data-dark={dark ? 'true' : undefined}
              data-picked={picked === sq ? 'true' : undefined}
              data-target={target ? (p || (state.board[picked ?? 0] ?.toLowerCase() === 'p' && sq === state.ep) ? 'capture' : 'move') : undefined}
              data-last={last && (last.from === sq || last.to === sq) ? 'true' : undefined}
              data-check={checkedKing === sq ? 'true' : undefined}
              aria-label={`${squareName(sq)}, ${p ? `${colorOf(p) === 'w' ? 'white' : 'black'} ${NAME[p.toLowerCase()]}` : 'empty'}`}
              onClick={() => tap(sq)}
            >
              {p && <span className="ch-piece" data-w={colorOf(p) === 'w' ? 'true' : undefined} aria-hidden="true">{GLYPH[p.toLowerCase()]}&#xFE0E;</span>}
              {(side === 'w' ? rank === 7 : rank === 0) && <i className="ch-file">{'abcdefgh'[file]}</i>}
              {(side === 'w' ? file === 0 : file === 7) && <i className="ch-rank">{8 - rank}</i>}
            </button>
          )
        })}
        {promo && (
          <div className="ch-promo" role="dialog" aria-label="Promote pawn">
            {PROMOS.map(({ p, label }) => <button key={p} type="button" onClick={() => play({ ...promo, promo: p })}>{label}</button>)}
          </div>
        )}
        {over && (
          <div className="ch-over" role="status">
            <strong>{result?.won ? 'You win!' : resigned ? 'You resigned' : st === 'checkmate' ? 'Checkmate' : 'Draw'}</strong>
            {!resigned && <span>{banner}</span>}
            <button type="button" className="primary-btn" onClick={() => setStarted(false)}>New game</button>
          </div>
        )}
      </div>
      <div className="ch-moves" aria-label="Moves">
        {moveText.map(({ n, san }) => <span key={n}>{n % 2 === 0 ? `${n / 2 + 1}. ` : ''}{san}</span>)}
      </div>
      <div className="ch-actions">
        <button type="button" className="secondary-btn ch-btn" onClick={undo} disabled={!myTurn || !plies.some((p) => p.before.turn === side)}>Undo</button>
        <button type="button" className="secondary-btn ch-btn" onClick={resign} disabled={over}>Resign</button>
        <button type="button" className="secondary-btn ch-btn" onClick={() => setStarted(false)}>New game</button>
      </div>
    </div>
  )
}
