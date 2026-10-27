import { useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { makeDeck, scoreFor } from './memory/deck'

export function MemoryGrid({ onFinish, seed }: GameProps) {
  const random = useMemo(() => createRandom(seed), [seed])
  const [deck, setDeck] = useState(() => makeDeck(random))
  const [open, setOpen] = useState<number[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const startedAt = useRef(Date.now())
  const reported = useRef(false)
  const complete = matched.length === deck.length

  useEffect(() => {
    if (open.length !== 2) return
    const [a, b] = open
    if (deck[a].symbol === deck[b].symbol) {
      setMatched((m) => [...m, a, b])
      setOpen([])
    } else {
      const t = setTimeout(() => setOpen([]), 650)
      return () => clearTimeout(t)
    }
  }, [open, deck])

  useEffect(() => {
    if (!complete || reported.current) return
    reported.current = true
    onFinish({ score: scoreFor(moves), durationMs: Date.now() - startedAt.current, won: true, stats: { moves } })
  }, [complete, moves, onFinish])

  const flip = (i: number) => {
    if (open.length === 2 || open.includes(i) || matched.includes(i)) return
    setOpen((o) => [...o, i])
    if (open.length === 1) setMoves((m) => m + 1)
  }

  const restart = () => {
    reported.current = false
    startedAt.current = Date.now()
    setDeck(makeDeck(random))
    setOpen([])
    setMatched([])
    setMoves(0)
  }

  return (
    <div className="memory">
      <div className="game-toolbar">
        <div>
          <small>Moves</small>
          <strong>{moves}</strong>
        </div>
        <button onClick={restart}>
          <RotateCcw size={16} />
          Reset
        </button>
      </div>
      <div className="memory-grid">
        {deck.map((card, i) => {
          const shown = open.includes(i) || matched.includes(i)
          return (
            <button
              key={card.id}
              className={shown ? 'flipped' : ''}
              onClick={() => flip(i)}
              aria-label={shown ? card.symbol : 'Hidden card'}
            >
              <span>{shown ? card.symbol : '?'}</span>
            </button>
          )
        })}
      </div>
      {complete ? <div className="win-message">Perfect sync! Score {scoreFor(moves)}</div> : null}
    </div>
  )
}
