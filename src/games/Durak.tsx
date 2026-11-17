import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { createRandom } from '../lib/rng'
import type { GameProps } from '../types'
import { SUITS, aiAttack, aiDefend, attack, canEnd, defend, done, isOver, legalAttacks, legalDefences, newGame, rankLabel, scoreFor, suitOf, take, toAct, type DState, type Level } from './durak/rules'
import './durak/durak.css'

/** Pause before the computer acts, so the player can follow. */
const THINK_MS = 650
const LEVELS: [Level, string][] = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']]
const SUIT_NAME = ['spades', 'hearts', 'diamonds', 'clubs']
const label = (id: number) => `${rankLabel(id)} of ${SUIT_NAME[suitOf(id)]}`

function Card({ id, trump, onClick, disabled, ok, hotkey }: { id: number; trump: boolean; onClick?: () => void; disabled?: boolean; ok?: boolean; hotkey?: number }) {
  const red = suitOf(id) === 1 || suitOf(id) === 2
  const face = <span>{rankLabel(id)}<small>{SUITS[suitOf(id)]}</small></span>
  const common = { 'data-red': red || undefined, 'data-trump': trump || undefined }
  if (!onClick) return <div className="du-card" {...common} role="img" aria-label={`${label(id)}${trump ? ', trump' : ''}`}>{face}</div>
  return (
    <button className="du-card" {...common} data-ok={ok || undefined} data-card={id} aria-label={`${label(id)}${trump ? ', trump' : ''}${hotkey ? `, key ${hotkey}` : ''}`} disabled={disabled} onClick={onClick}>{face}</button>
  )
}

export function Durak({ onFinish, seed }: GameProps) {
  const [level, setLevel] = useState<Level>('normal')
  const base = seed ?? 'durak'
  const [run, setRun] = useState(0)
  const [game, setGame] = useState<DState>(() => newGame(base))
  const random = useMemo(() => createRandom(`${base}:${run}:ai`), [base, run])
  const startedAt = useRef(0)
  const over = isOver(game)

  // A run is reported once, from the handler or timer that ends it, never from a state updater.
  const commit = useCallback(
    (next: DState) => {
      setGame(next)
      if (isOver(next)) {
        onFinish({
          score: scoreFor(next),
          durationMs: Date.now() - startedAt.current,
          won: next.winner === 0,
          stats: { bouts: next.bouts, cardsLeft: next.hands[0].length, opponentCards: next.hands[1].length, durak: next.durak === 0 ? 1 : 0 },
        })
      }
    },
    [onFinish],
  )

  // The computer attacks, defends and takes on a short delay.
  useEffect(() => {
    if (over || toAct(game) !== 1) return
    const timer = setTimeout(() => {
      if (game.phase === 'defend') {
        const m = aiDefend(game, 1, level, random)
        commit(m === 'take' ? take(game, 1) : defend(game, 1, m.card, m.index))
      } else {
        const m = aiAttack(game, 1, level, random)
        commit(m === 'done' ? done(game, 1) : attack(game, 1, m))
      }
    }, THINK_MS)
    return () => clearTimeout(timer)
  }, [game, level, random, over, commit])

  const mine = game.hands[0]
  const yourTurn = !over && toAct(game) === 0
  const canLead = useMemo(() => new Set(yourTurn && game.phase !== 'defend' ? legalAttacks(game) : []), [game, yourTurn])
  const canBeat = useMemo(() => new Set(yourTurn && game.phase === 'defend' ? legalDefences(game).map((o) => o.card) : []), [game, yourTurn])

  const begin = () => {
    if (!startedAt.current) startedAt.current = Date.now()
  }
  const pick = (id: number) => {
    if (!yourTurn) return
    begin()
    if (game.phase === 'defend') commit(defend(game, 0, id))
    else commit(attack(game, 0, id))
  }
  const doTake = () => {
    if (!yourTurn || game.phase !== 'defend') return
    begin()
    commit(take(game, 0))
  }
  const doDone = () => {
    if (!yourTurn || !canEnd(game)) return
    begin()
    commit(done(game, 0))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= Math.min(9, mine.length)) pick(mine[n - 1])
      else if (e.key === 't' || e.key === 'T') doTake()
      else if (e.key === 'd' || e.key === 'D') doDone()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  const restart = (l: Level = level) => {
    setLevel(l)
    setRun((r) => r + 1)
    setGame(newGame(`${base}:${run + 1}`))
    startedAt.current = 0
  }

  const youAttack = game.attacker === 0
  const status = over
    ? game.draw ? 'Draw' : game.winner === 0 ? 'You win!' : 'You are the durak'
    : yourTurn
      ? game.phase === 'defend' ? 'Your move: beat the card or take' : game.phase === 'take' ? 'Add more cards, or end the bout' : game.table.length ? 'Add a card, or end the bout' : 'Your attack: lead a card'
      : game.phase === 'defend' ? 'Computer is defending…' : 'Computer is thinking…'
  const trumpName = SUIT_NAME[game.trump]

  return (
    <div className="du">
      <div className="game-toolbar c4-bar">
        <div>
          <small>{youAttack ? 'You attack' : 'Computer attacks'}</small>
          <strong className="c4-status" aria-live="polite">{status}</strong>
        </div>
        <button onClick={() => restart()}><RotateCcw size={15} />New</button>
      </div>
      <div className="du-opts">
        <label>Computer<select aria-label="Computer level" value={level} onChange={(e) => restart(e.target.value as Level)}>{LEVELS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <span className="du-deck" aria-label={`Draw pile ${game.deck.length} cards, trump ${trumpName}`}>
          {game.deck.length > 0 ? <Card id={game.trumpCard} trump /> : null}
          <span>Deck {game.deck.length} · Trump {SUITS[game.trump]}</span>
        </span>
      </div>
      <div className="du-felt">
        <div className="du-row du-comp" role="group" aria-label={`Computer holds ${game.hands[1].length} cards`}>
          {game.hands[1].map((_, i) => <div key={i} className="du-card" data-back="true" aria-hidden="true" />)}
        </div>
        <div className="du-table" role="group" aria-label="Cards on the table">
          {game.table.map((p) => (
            <div key={p.attack} className="du-pair">
              <Card id={p.attack} trump={suitOf(p.attack) === game.trump} />
              {p.defence !== null ? <Card id={p.defence} trump={suitOf(p.defence) === game.trump} /> : null}
            </div>
          ))}
        </div>
        <div className="du-row du-hand" aria-label="Your cards">
          {mine.map((c, i) => {
            const usable = canLead.has(c) || canBeat.has(c)
            return <Card key={c} id={c} trump={suitOf(c) === game.trump} hotkey={i < 9 ? i + 1 : undefined} ok={usable} disabled={over || !usable} onClick={() => pick(c)} />
          })}
        </div>
        <div className="du-actions">
          {yourTurn && game.phase === 'defend' ? <button className="primary-btn" onClick={doTake}>Take the cards</button> : null}
          {yourTurn && canEnd(game) ? <button className="primary-btn" onClick={doDone}>{game.phase === 'take' ? 'Done adding' : 'End the bout'}</button> : null}
        </div>
      </div>
      <p className="game-help">Beat each attack with a higher card of the same suit, or any trump (outlined in gold). If you cannot, or choose not to, take the cards. Add cards of a rank already on the table when attacking. Tap a glowing card or press 1 to 9, T to take, D to end the bout. Passing the attack on is not allowed. Get rid of all your cards once the deck is gone and the other player is the durak.</p>
      {over ? (
        <div className="game-over">
          <h3>{status}</h3>
          <p>{game.bouts} bouts · score {scoreFor(game)}</p>
          <button className="primary-btn" onClick={() => restart()}>Play again</button>
        </div>
      ) : null}
    </div>
  )
}
